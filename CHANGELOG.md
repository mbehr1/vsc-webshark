# Change log for 'vsc-webshark':

### [1.3.1](https://github.com/mbehr1/vsc-webshark/compare/v1.3.0...v1.3.1) (2021-05-09)


### Bug Fixes

* use 0 instead of undefined on close ([284fa72](https://github.com/mbehr1/vsc-webshark/commit/284fa726fcd49892f08da9a048fcb00d2854eaf6))

## [1.3.0](https://github.com/mbehr1/vsc-webshark/compare/v1.2.0...v1.3.0) (2021-05-01)


### Features

* **dlt export:** add TECMP UART/RS232_RAW ([d10fb38](https://github.com/mbehr1/vsc-webshark/commit/d10fb38adfc28c93e0fbbe54fac927f300edca6b))

## [1.2.0](https://github.com/mbehr1/vsc-webshark/compare/v1.1.2...v1.2.0) (2021-02-20)


### Features

* **filter:** add filterOp to filterSteps ([f7515eb](https://github.com/mbehr1/vsc-webshark/commit/f7515ebb51ed74a757708a1e4b394248fabb5ec8))
* **filterpcap:** add listProviderOptions groupBy ([742f33b](https://github.com/mbehr1/vsc-webshark/commit/742f33be12c4f8c905899d4229ff89ed89ade238))

### [1.1.2](https://github.com/mbehr1/vsc-webshark/compare/v1.1.1...v1.1.2) (2021-02-14)


### Bug Fixes

* win escape shell chars ([a025150](https://github.com/mbehr1/vsc-webshark/commit/a0251508d56a4276748d5705fc0a426f6a37aa76))

### [1.1.1](https://github.com/mbehr1/vsc-webshark/compare/v1.1.0...v1.1.1) (2021-01-13)


### Bug Fixes

* **extractdlt:** use sync file ops ([e1294fb](https://github.com/mbehr1/vsc-webshark/commit/e1294fba2d9b429352c6e7a5d3fff9f8a656c405))

## [1.1.0](https://github.com/mbehr1/vsc-webshark/compare/v1.0.2...v1.1.0) (2021-01-12)


### Features

* **removetecmp:** first poc of remove TECMP enscapsulation ([f3b05c1](https://github.com/mbehr1/vsc-webshark/commit/f3b05c186f2da5c0cdac8b8048d4f225004ddc86))

### [1.0.2](https://github.com/mbehr1/vsc-webshark/compare/v1.0.1...v1.0.2) (2021-01-04)


### Bug Fixes

* **webview:** keep FIFO order for queued msgs ([196c3a4](https://github.com/mbehr1/vsc-webshark/commit/196c3a4bef9c753153f607c307a1b8ed7012d8fc))

### [1.0.1](https://github.com/mbehr1/vsc-webshark/compare/v1.0.0...v1.0.1) (2020-12-28)


### Bug Fixes

* **logging:** typo in log message ([9967207](https://github.com/mbehr1/vsc-webshark/commit/9967207a80ba5a0acdb37984a204558fd2585819))

### [1.0.0]
* promoted version to 1.0.0 to prepare for automatic semantic-release versioning. No functional changes.

### [0.9.4]
- updated dependencies after github security advisory

### [0.9.3]
- fixed extension version log

### [0.9.2]
- changed mac/ip filterstep default to ignore icmp packets.

### [0.9.1]
- Updated package dependencies to newer versions.

### [0.9.0]
- Add support to open cap/pcap/pcapng files directly. Requires vscode >=1.46.

### [0.8.0]
- Add support for multiple input files for "filter pcap..." and "Extract DLT from pcap file..."

### [0.7.0]
- Added "Extract DLT from pcap file..." feature.

### [0.6.1]
- Clear prev. filter pcap quick pick results

### [0.6.0]
- Added "filter pcap ..." function.

### [0.5.1]
- Delayed checkActiveExtensions a bit.

### [0.5.0]
- Add "adjustTime" (via context menu on a selected frame) implementation including a "sync to last received time event".

### [0.4.2]
- Fixed tree view selection not working if no filter was set.

### [0.4.1]
- Fixed number of events found messages being wrong.

### [0.4.0]
- added sorting events by timestamp and indenting by level.
- selecting an event reveals an event close to it by time.

### [0.3.5]
- added configuration setting conversionFunction that allows to specify a function for timeSync value conversion. This was needed as the displayFilter that sharkd supports for columns don't offer e.g. slicing [...]. So it's useful to convert for e.g. needed hexdump conversion (0x0000 vs 00 00 vs 0x00 0x00...). 
- removed automatic toLower on timeSync value. If you want it back use "return values.join(' ').toLower();" as conversion function.
- added event label parsing. Still missing sorting by timestamp and indenting by level. 

### [0.3.4]
- timeSync values will be in lower case (as defined) and if multiple values are provided they will be concated with ' '.

### [0.3.3]
- yet another win32 fix. first working win32 version.

### [0.3.2]
- win32 related fixes (\r\n parsing, removed /tmp as cwd,...)
- 'Hello in child' might be fragmented.

### [0.3.1]
- added info about missing sharkd binary on windows installations. Investigating...
- First bits+pieces for events explorer. Not finished yet.

### [0.3.0]
- time sync part 3: timeSync events. broadcasted and on reception adjust time (not reflected in view but for reveal)
- event definition is prepared for events explorer tree view (label, level)

### [0.2.0]
- time sync part 2: react to broadcasted time events by revealing the frame close to that time.

### [0.1.0]
- time sync part 1: double click broadcasts the (utc) time from the selected frame.
- filter are persisted on vscode restart

### [0.0.2]
- Close sharkd child process on closing the document
- document retains content when put in the background
- automatic reopening of document on vscode restart

### [0.0.1]

- Initial release ("proof of concept" alike)
