# Spec Delta

## Purpose

Lets users print what they see in a 2D map or a 3D scene in the browser, with no print service:
a framed print area, a Letter page with a title, legend, scale and credits (a GeoPDF), or the map
alone as an image.

## ADDED Requirements

### Requirement: Print map works in maps and scenes without a print service
A `print-map` component SHALL work in 2D maps and 3D scenes. It SHALL make its files in the
browser, sending nothing to a print service. It SHALL go in a sidebar panel (heading "Print map",
`print` icon) or in a map corner behind an expand button. Without an API key it SHALL be offered.

#### Scenario: Print from a scene
- **GIVEN** an app with `"view": "3d"` and a `print-map` panel
- **WHEN** the user opens the Print map panel and presses Export
- **THEN** a PDF downloads, and the app made no request to a print service

#### Scenario: Print from a map
- **GIVEN** a 2D app with a `print-map` panel
- **WHEN** the user opens the Print map panel and presses Export
- **THEN** a PDF downloads

#### Scenario: In a corner
- **GIVEN** a `print-map` component placed `bottom-left` with `"expand": true`
- **WHEN** the user presses its button
- **THEN** the Print map controls open over the map beside the button

### Requirement: The print area shows what will print
While the component is open, the map SHALL show the print area: a frame in the shape of the
page's map, as large as fits in the visible map, with the map outside it dimmed. The user SHALL
still pan, zoom and rotate the map under it. Changing the orientation SHALL change the frame's
shape. When the component closes, the frame and dimming SHALL go away.

#### Scenario: Frame while open
- **GIVEN** a `print-map` panel with Landscape chosen
- **WHEN** the user opens the panel
- **THEN** a frame wider than it is tall (10 by 6.25) shows on the map, beside the sidebar, with the map outside it dimmed, and the map still pans when dragged inside it

#### Scenario: Portrait frame
- **WHEN** the user chooses Portrait in the open panel
- **THEN** the frame becomes taller than it is wide (7.5 by 8)

#### Scenario: Frame gone when closed
- **WHEN** the user closes the Print map panel, or its expand
- **THEN** the frame and dimming are gone

### Requirement: The print captures the print area
The printed map SHALL be the part of the map inside the frame, with what the map shows at that
moment: basemap, layers, labels, sketches and graphics. The picture SHALL be 300 DPI at its
size on the page. A JPEG SHALL be that picture on its own.

#### Scenario: Same as the frame
- **GIVEN** the frame shows a river bend with an access point at its middle
- **WHEN** the user exports a PDF
- **THEN** the page's map shows the same bend with the access point at its middle, and nothing from outside the frame

#### Scenario: Map image
- **GIVEN** Landscape and "Map image" chosen
- **WHEN** the user presses Export
- **THEN** a JPEG downloads that is 3000 by 1875 pixels and shows the frame's contents and no page layout

### Requirement: The PDF is a Letter page with a title, legend, scale and credits
A PDF SHALL be one Letter page in the chosen orientation with 0.4 inch margins. It SHALL have
the title above the map, and below the map the date and the legend on the left, and the scale
and the map's credits on the right. The scale SHALL be a ratio (1:N) and a scale bar in miles.
The credits SHALL be those of the visible basemap and layers, each listed once.

#### Scenario: Page layout
- **GIVEN** the title "Ponca to Kyles" and Landscape chosen
- **WHEN** the user exports a PDF
- **THEN** the PDF has one 11 by 8.5 inch page with "Ponca to Kyles" above the map, today's date and the legend below it on the left, and a 1:N ratio, a miles scale bar and the credits on the right

#### Scenario: Scale matches the map
- **GIVEN** a 2D map looking at an area where the frame is 5 miles across
- **WHEN** the user exports a PDF and measures the scale bar against the map on the page
- **THEN** the scale bar's distance matches the map's within 2%

#### Scenario: File name
- **WHEN** the user exports with the title "Ponca to Kyles"
- **THEN** the file is named `Ponca to Kyles.pdf`, or `.jpg` for a map image

#### Scenario: No title
- **WHEN** the user clears the title and exports a PDF
- **THEN** the page has no title line, and the file is named after the app's title

### Requirement: The legend shows the visible layers
The legend SHALL list the map's visible operational layers, including layers in groups, in the
order of the layer list. A layer drawn with one symbol SHALL have one row with that symbol. A
layer whose symbol varies by value SHALL have a row per class under its title. Layers without a
drawable symbol SHALL have their title alone. Hidden layers SHALL be left out.

#### Scenario: Visible layers only
- **GIVEN** the Buffalo River app with only the river and the access points on
- **WHEN** the user exports a PDF
- **THEN** the legend lists Access points with its symbol, and Buffalo River with a row for each level class, and nothing for the hidden points of interest

#### Scenario: Turning a layer on adds it
- **GIVEN** the user turned on the Bluffs layer
- **WHEN** the user exports a PDF
- **THEN** the legend also lists Bluffs with its icon

#### Scenario: Too many rows
- **WHEN** the visible layers have more rows than the legend has room for
- **THEN** the legend ends with a line saying how many more were left out, and nothing is drawn outside its area

### Requirement: The PDF records where the map is
A PDF of a map that is to scale SHALL record the map's location (GeoPDF), so that map apps that
read it place each point of the printed map at its place on the ground. Other PDF viewers SHALL
show the page the same as without it.

#### Scenario: Located in a map app
- **GIVEN** a PDF exported from a 2D map, or from a scene looking straight down
- **WHEN** it is opened in Avenza Maps or Adobe Acrobat's geospatial tools
- **THEN** a point picked on the printed map reads within 50 m of its coordinates in the viewer

### Requirement: A tilted scene prints without a scale
In a 3D scene whose view is tilted more than 2 degrees from straight down, the PDF SHALL leave
out the scale ratio, the scale bar and the location record, and SHALL say "Not to scale" where
the scale would be. While the view is tilted, the open component SHALL say that the print will
not be to scale.

#### Scenario: Tilted
- **GIVEN** a scene tilted to 60 degrees
- **WHEN** the user opens the Print map panel and exports a PDF
- **THEN** the panel says the print won't be to scale, and the page says "Not to scale" with no ratio or scale bar, and has no location record

#### Scenario: Straight down
- **GIVEN** a scene looking straight down
- **WHEN** the user exports a PDF
- **THEN** the page has the ratio and the scale bar, and the PDF has the location record

### Requirement: Print map options set the starting choices
A `print-map` component's `title` option (text) SHALL set the starting title, or the app's title
when omitted. `orientation` (`landscape` or `portrait`, default `landscape`) and `format` (`pdf`
or `jpg`, default `pdf`) SHALL set the starting choices. The user SHALL be able to change all
three in the component.

#### Scenario: Defaults
- **WHEN** a `print-map` component has no options in an app titled "Buffalo River"
- **THEN** the panel shows the title "Buffalo River", Landscape and PDF

#### Scenario: Configured
- **WHEN** a `print-map` component has `"options": { "title": "Field map", "orientation": "portrait", "format": "jpg" }`
- **THEN** the panel shows the title "Field map", Portrait and Map image

#### Scenario: Invalid orientation
- **WHEN** a `print-map` component has `"options": { "orientation": "square" }`
- **THEN** validation fails with an error at `components[0].options.orientation` that lists `landscape` and `portrait`

### Requirement: A failed print is explained
When the map can't be captured or the file can't be made, the component SHALL say so in the
component, keep its choices, and let the user try again. While a print is being made, Export
SHALL show that it is busy and SHALL not start a second print.

#### Scenario: Capture fails
- **GIVEN** a layer from a server that doesn't allow its images to be read back
- **WHEN** the user exports
- **THEN** the component says the map couldn't be printed, and Export works again once that layer is turned off

#### Scenario: Busy
- **WHEN** the user presses Export twice quickly
- **THEN** one file downloads, and Export shows it is busy until then
