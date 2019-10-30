Thank you for your interest on contributing!
Below are things to do manually whenever you want to produce a new release.

1. Go to the [Twemoji releases](https://github.com/twitter/twemoji/releases) page and find the most recent release.
2. Download the zip or tar.gz file.
3. Unzip/untar it.
4. Re-zip the files in `assets/svg` as `twe-svg.zip` but keep the `svg` directory. You can do that by running this command in the `assets` directory: `zip -r -9 twe-svg.zip svg`.
5. Replace the in-tree `twe-svg.zip` file.
6. Amend the `twe-svg.zip.version.txt` file and paste the URL of the released zip you've downloaded.
7. Amend the version number `package.json`.
8. Run the build command with `make`. Please look at [README.md](./README.md) to figure out dependencies and how to install them.

The resulting font can be found at `build/Twemoji Mozilla.ttf`.

You would need to ensure the glyph layers are converted correctly by running our test suite.

1. Start a localhost server at the working directory. You can do that by running `python -m SimpleHTTPServer 28009`.
2. Navigate to `http://localhost:28009/tests/` with Firefox.
3. Ensure you can see the Twemoji smiling face on the title (indicated the web font is loaded), hit "Test all".
4. Give it a few minutes to compare all glyphs.
5. Observe the flagged items; generally there are a lot of false negatives, we should look at missing strokes or layers that could really affect the visual look of the glyph.
