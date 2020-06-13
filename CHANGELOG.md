# Change Log

All notable changes to the "vsc-webshark" extension will be documented in this file.

## [0.9.1]
- Updated package dependencies to newer versions.

## [0.9.0]
- Add support to open cap/pcap/pcapng files directly. Requires vscode >=1.46.

## [0.8.0]
- Add support for multiple input files for "filter pcap..." and "Extract DLT from pcap file..."

## [0.7.0]
- Added "Extract DLT from pcap file..." feature.

## [0.6.1]
- Clear prev. filter pcap quick pick results

## [0.6.0]
- Added "filter pcap ..." function.

## [0.5.1]
- Delayed checkActiveExtensions a bit.

## [0.5.0]
- Add "adjustTime" (via context menu on a selected frame) implementation including a "sync to last received time event".

## [0.4.2]
- Fixed tree view selection not working if no filter was set.

## [0.4.1]
- Fixed number of events found messages being wrong.

## [0.4.0]
- added sorting events by timestamp and indenting by level.
- selecting an event reveals an event close to it by time.

## [0.3.5]
- added configuration setting conversionFunction that allows to specify a function for timeSync value conversion. This was needed as the displayFilter that sharkd supports for columns don't offer e.g. slicing [...]. So it's useful to convert for e.g. needed hexdump conversion (0x0000 vs 00 00 vs 0x00 0x00...). 
- removed automatic toLower on timeSync value. If you want it back use "return values.join(' ').toLower();" as conversion function.
- added event label parsing. Still missing sorting by timestamp and indenting by level. 

## [0.3.4]
- timeSync values will be in lower case (as defined) and if multiple values are provided they will be concated with ' '.

## [0.3.3]
- yet another win32 fix. first working win32 version.

## [0.3.2]
- win32 related fixes (\r\n parsing, removed /tmp as cwd,...)
- 'Hello in child' might be fragmented.

## [0.3.1]
- added info about missing sharkd binary on windows installations. Investigating...
- First bits+pieces for events explorer. Not finished yet.

## [0.3.0]
- time sync part 3: timeSync events. broadcasted and on reception adjust time (not reflected in view but for reveal)
- event definition is prepared for events explorer tree view (label, level)

## [0.2.0]
- time sync part 2: react to broadcasted time events by revealing the frame close to that time.

## [0.1.0]
- time sync part 1: double click broadcasts the (utc) time from the selected frame.
- filter are persisted on vscode restart

## [0.0.2]
- Close sharkd child process on closing the document
- document retains content when put in the background
- automatic reopening of document on vscode restart

## [0.0.1]

- Initial release ("proof of concept" alike)
