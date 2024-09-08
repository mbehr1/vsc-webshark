# Change log for 'vsc-webshark':

## [2.1.1](https://github.com/mbehr1/vsc-webshark/compare/v2.1.0...v2.1.1) (2024-09-08)


### Bug Fixes

* add support for wireshark >= v4.1 ([cbf934d](https://github.com/mbehr1/vsc-webshark/commit/cbf934d923913730ab1b7773ca773c613e7711b8)), closes [#29](https://github.com/mbehr1/vsc-webshark/issues/29)

## [2.1.0](https://github.com/mbehr1/vsc-webshark/compare/v2.0.4...v2.1.0) (2023-11-06)


### Features

* **wireshark profiles:** allow to provide wireshark profiles via 'vsc-webshark.sharkdProfile' ([7769c2a](https://github.com/mbehr1/vsc-webshark/commit/7769c2a54ac02adbb23131cae106b709b49c276d))
* **wireshark profiles:** allow to provide wireshark profiles via 'vsc-webshark.sharkdProfile' ([622bbcc](https://github.com/mbehr1/vsc-webshark/commit/622bbccad4a1dc6e7ec7dd28f14b7d295ba20087))
* **wireshark profiles:** allow to provide wireshark profiles via 'vsc-webshark.sharkdProfile' ([392e5ae](https://github.com/mbehr1/vsc-webshark/commit/392e5aee771abc38438c4c8179a7d4dc829f9643))

## [2.0.4](https://github.com/mbehr1/vsc-webshark/compare/v2.0.3...v2.0.4) (2023-03-05)


### Bug Fixes

* use status warning for yellow/deprecated ([31a2ca7](https://github.com/mbehr1/vsc-webshark/commit/31a2ca7bac24df1cc9bef21a8d7d07813ab1e238))

## [2.0.3](https://github.com/mbehr1/vsc-webshark/compare/v2.0.2...v2.0.3) (2023-03-05)


### Bug Fixes

* extract multiple dlt frames per udp packet ([23cd394](https://github.com/mbehr1/vsc-webshark/commit/23cd3942e871c4ad04a96e45723f92d10890f0be))

## [2.0.2](https://github.com/mbehr1/vsc-webshark/compare/v2.0.1...v2.0.2) (2023-03-04)

### [2.0.1](https://github.com/mbehr1/vsc-webshark/compare/v2.0.0...v2.0.1) (2023-03-04)


### Bug Fixes

* add warning message for unepected stderr ([7f79048](https://github.com/mbehr1/vsc-webshark/commit/7f79048128bcdbc9bf5e159d9df42367e8602e87))

## [2.0.0](https://github.com/mbehr1/vsc-webshark/compare/v1.7.1...v2.0.0) (2023-03-04)


### ⚠ BREAKING CHANGES

* support wireshark v3.5 and newer

### Features

* support wireshark v3.5 and newer ([87546f9](https://github.com/mbehr1/vsc-webshark/commit/87546f92199eb388cfe38b7f34fa237f0facaea6))

### [1.7.1](https://github.com/mbehr1/vsc-webshark/compare/v1.7.0...v1.7.1) (2022-09-09)


### Bug Fixes

* **tecmp:** support 0x99fe (orig) ethertype as well ([69abcc2](https://github.com/mbehr1/vsc-webshark/commit/69abcc25d280941ae79ff5bbc1a6f7a03546bbd1))

## [1.7.0](https://github.com/mbehr1/vsc-webshark/compare/v1.6.0...v1.7.0) (2022-01-07)


### Features

* **remove_tecmp:** adjust to newer dissector ([c94fcbc](https://github.com/mbehr1/vsc-webshark/commit/c94fcbc0b967c14b4b515d2080047135a1edd381))

## [1.6.0](https://github.com/mbehr1/vsc-webshark/compare/v1.5.1...v1.6.0) (2021-05-22)


### Features

* add icons to treeview for files and events folder ([49c12b4](https://github.com/mbehr1/vsc-webshark/commit/49c12b40610c7a5624fb8345f6629450afb19621))
* configurable columns ([011a9d4](https://github.com/mbehr1/vsc-webshark/commit/011a9d4d15ab7856c39b4541cdecb6e7a93d070c)), closes [#6](https://github.com/mbehr1/vsc-webshark/issues/6)

### [1.5.1](https://github.com/mbehr1/vsc-webshark/compare/v1.5.0...v1.5.1) (2021-05-13)


### Bug Fixes

* opt out for virtual workspaces ([5efbe46](https://github.com/mbehr1/vsc-webshark/commit/5efbe46c8c22b75245467541f6c5a6531918afa6))

## [1.5.0](https://github.com/mbehr1/vsc-webshark/compare/v1.4.0...v1.5.0) (2021-05-13)


### Features

* limit support in untrusted workspaces ([2352be8](https://github.com/mbehr1/vsc-webshark/commit/2352be8cfaf450c14654311671c3b345c53baa07)), closes [#5](https://github.com/mbehr1/vsc-webshark/issues/5)

## [1.4.0](https://github.com/mbehr1/vsc-webshark/compare/v1.3.1...v1.4.0) (2021-05-13)


### Features

* no support in untrusted workspaces ([a6591df](https://github.com/mbehr1/vsc-webshark/commit/a6591dff75df367cc23c4883c8d6e87c422b413e)), closes [#5](https://github.com/mbehr1/vsc-webshark/issues/5)

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
