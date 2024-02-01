# Change Log

## 0.7.2 - January 18, 2023
* Optimize image files to further reduce download and install size.

## 0.7.1 - January 18, 2023
* Reduce install size.
* Switch to `onStartupFinished` to defer extension activation.

## 0.7.0 - September 8, 2021
* Webpack extension to improve performance and reduce install size.
* Add support for running in browsers.

## 0.6.1 - July 5, 2021
* Update extension kind to support workspace if requested. Thanks @bamurtaugh!

## 0.6.0 - April 26, 2021
* Add LCH color display. Thanks @mgcrea!

## 0.5.1 - April 24, 2019
* Mark explicit extension kind for VS Code compatibility.

## 0.5.0 - June 13, 2017
* Add support for hex colors with alpha: `#f0f7` and `#ff00ff77`

## 0.4.1 - April 17, 2017
* Fix hex not detecting in strings such as `"#f0f"` 

## 0.4.0 - April 3, 2017
* Provide color info in scss by default. Thanks @smlombardi!

## 0.3.0 - March 16, 2017
* Added `css-color-name` display field to show color name.

## 0.2.1 - December 30, 2016
* Fixed some false positive color name matches.

## 0.2.0 - December 14, 2016
* Added `colorInfo.languages` setting to allow using the extension for any file type and language.
* Fixed a few false positive matches.

## 0.1.1 – Nov 28, 2016
* Fix alpha in preview display not showing.

## 0.1.0 – Nov 28, 2016
* Added color preview displays.
* Made settings use enum values for better intellisense.
