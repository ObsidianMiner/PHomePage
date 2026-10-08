# PHomePage
My personal homepage designed to do exactly what it needs to do.

You can **customize** the links at the bottom and the gallery images in the back to your liking with a full UI to do so.

![alt text](preview.png)

# Features



# How to setup

- [Install this](https://chromewebstore.google.com/detail/custom-new-tab-url/mmjbdbjnoablegbkcklggeknkfcjkjia) or any other custom new tab page extension to set it as your home page.
- Set the location of index.html on your device as the homepage.
- Make sure to allow the extension access to file urls.

## To install support for aditional features. You can setup home helper
Home helper adds support for opening specific links in a seperate chrome user, different browser, and adding photos to the gallery.

To install it just run
python setup.py
with python installed. It will then use that version of python when executing any phome commands via the website.

# How To Use

## Adding to the gallery
Place photos you want to display in the background gallery within the gallery folder.
Once you are done run generate_gallery.py with python

## Setting a link to open in a different browser / chrome user
To open with firefox simply write firefox in the config box (the last one in the links editor)

To open with a different user write | Profile 2 (The name is different depending on what the internal name of your profile is)