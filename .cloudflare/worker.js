// This worker is hosted at phome-sync.obpickleman.workers.dev

async function hashSecret(secret) {
    const hashBuffer = await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(secret),
    );

    return [...new Uint8Array(hashBuffer)]
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
}
export default {
    async fetch(request, env) {
        const url = new URL(request.url);
        const origin = request.headers.get("Origin");
        const path = url.pathname.slice(1); // "links" or "notes" or "register"

        const corsHeaders = {
            "Access-Control-Allow-Origin": origin || "*",
            "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, X-Secret, Username",
        };

        // Preflight before auth
        if (request.method === "OPTIONS") {
            return new Response(null, { headers: corsHeaders });
        }


        if (path == "register") {
            if (request.method !== "POST") {
                return new Response("Method not allowed", { status: 405, headers: corsHeaders });
            }

            const username = request.headers.get("Username");

            if (!username) {
                return new Response("Username required", { status: 400, headers: corsHeaders })
            }

            // Limit username length
            if (username.length > 50) {
                return new Response("Username too long", { status: 400, headers: corsHeaders });
            }

            // Only allow simple usernames.
            if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
                return new Response("Invalid username", { status: 400, headers: corsHeaders });
            }

            //Ensure that an account with that name does not already exist
            const account = await env.DB.prepare(
                `
            SELECT id, secret_hash
            FROM accounts
            WHERE username = ?
            `,
            )
                .bind(username)
                .first();


            if (account != null) {
                return new Response("Username already exists", { status: 409 });
            }

            // Generate the user's secret token
            const token = crypto.randomUUID() + crypto.randomUUID();

            // Get the hash
            const secretHash = await hashSecret(token);

            // Add the hash to the database
            try {
                await env.DB.prepare(
                    `
                INSERT INTO accounts (username, secret_hash)
                VALUES (?, ?)
                `,
                )
                    .bind(username, secretHash)
                    .run();
            }
            catch {
                // The UNIQUE constraint may catch a race where another request created the same username.
                return new Response("Username already exists", { status: 409, headers: corsHeaders });
            }

            // Return the secret back to the client
            return new Response(JSON.stringify({ username, secret: token }), {
                status: 201,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        } else if (["links", "notes"].includes(path)) {
            // Auth check
            const username = request.headers.get("Username");
            const secret = request.headers.get("X-Secret");

            if (!username || !secret) {
                return new Response("Unauthorized", { status: 401 });
            }

            const account = await env.DB.prepare(
                `
            SELECT id, secret_hash
            FROM accounts
            WHERE username = ?
            `,
            )
                .bind(username)
                .first();

            if (account == null) {
                return new Response("Unauthorized", { status: 401 });
            }

            const suppliedHash = await hashSecret(secret);

            if (suppliedHash !== account.secret_hash) {
                return new Response("Unauthorized", { status: 401 });
            }

            const kvKey = `account/${account.id}/${path}`;



            if (request.method === "GET") {
                const value = await env.DATA.get(kvKey);
                return new Response(value ?? "", {
                    headers: { ...corsHeaders, "Content-Type": "application/json" },
                });
            }

            if (request.method === "PUT") {
                const body = await request.text();
                await env.DATA.put(kvKey, body);
                return new Response("OK", { headers: corsHeaders });
            }

            return new Response("Method not allowed", {
                status: 405,
                headers: corsHeaders,
            });
        } else {
            return new Response("Not found", { status: 404, headers: corsHeaders });
        }
    },
};
