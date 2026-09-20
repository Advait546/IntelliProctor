# Test Data Directory

Organize test images into the following subdirectories by category:

- `phone/` : Images containing cell phones
- `book/` : Images containing books / textbooks
- `smartwatch/` : Images containing smartwatches / watches
- `laptop/` : Images containing laptops / computers
- `tablet/` : Images containing tablets / iPads
- `calculator/` : Images containing calculators
- `notebook/` : Images containing notebooks / paper pads
- `pen/` : Images containing pens / pencils
- `water_bottle/` : Images containing water bottles / drink containers
- `headphones/` : Images containing headphones / earphones
- `other/` : Images containing other common objects

### Image File Formats Supported
`.jpg`, `.jpeg`, `.png`, `.webp`, `.bmp`

If a directory has no test images, pytest will automatically mark tests for that category as `SKIPPED` without failing the test suite.
