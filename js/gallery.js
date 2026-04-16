try
{
  const shuffled = getEnabledImages().sort(() => Math.random() - 0.5);


  const selected = shuffled.slice(0, 5);
  const galleryContainer = document.querySelector(".gallery");

  if (selected.length === 0) {
    // No images — optionally hide or show fallback UI
    galleryContainer.style.display = "none";
  }
  else
  {
    const imgElements = selected.map(src => {
      const img = document.createElement("img");
      img.src = src;
      img.style.opacity = 0;
      galleryContainer.appendChild(img);
      return img;
    });

    let galleryIndex = 0;
    imgElements[0].style.opacity = 0.25;

    // Show the first image
    imgElements[galleryIndex].style.opacity = 0.25;

    if (imgElements.length > 1)
    {
      function rotateGallery() {
        const current = imgElements[galleryIndex];
        galleryIndex = (galleryIndex + 1) % imgElements.length;
        const next = imgElements[galleryIndex];

        // Fade out current, fade in next
        current.style.opacity = 0;
        next.style.opacity = 0.25;
      }
      setInterval(rotateGallery, 10000); // every 10s
    }
  }
}
catch (e)
{
  console.error(e);
  showErrorToast?.("Gallery failed to load: " + e.message);
}