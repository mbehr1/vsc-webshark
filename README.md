# vsc-webshark README

[![Version](https://vsmarketplacebadge.apphb.com/version/mbehr1.vsc-webshark.svg)](https://marketplace.visualstudio.com/items?itemName=mbehr1.vsc-webshark)

This Visual Studio Code(tm) extension adds support to open pcap/network files.

**Note:** It's acts mainly as a UI to a local wireshark installation. So wireshark (incl sharkd) need to be locally installed.

**Note:** Currently I do find "sharkd" for windows only as part of the Wireshark Win32 Portable packages [win32/WiresharkPortable_latest](https://wireshark.org/download/win32/WiresharkPortable_latest.paf.exe). Extracting the wireshark folder into any local folder and pointing the sharkdFullPath setting to it seems to work (so keeping the regular installation untouched).

## Features

- Open 'pcap' network capture files. Use command "open pcap file...";
- Display filter with known syntax from wireshark
- ...

The extension uses telemetry with one event (`open file`, errorcode as parameter) if telemetry is activated within your general configuration.

## Planned features

- add **Time sync** support to work with **smart-log**[![Version](https://vsmarketplacebadge.apphb.com/version-short/mbehr1.smart-log.svg)](https://marketplace.visualstudio.com/items?itemName=mbehr1.smart-log) and **dlt-logs**[![Version](https://vsmarketplacebadge.apphb.com/version-short/mbehr1.dlt-logs.svg)](https://marketplace.visualstudio.com/items?itemName=mbehr1.dlt-logs) extensions.

## Requirements

If you have any requirements or dependencies, add a section describing those and how to install and configure them.

## Extension Settings

This extension contributes the following settings:

* `vsc-webshark.sharkdFullPath`: Specifies the absolute path incl filename to the sharkd binary. This needs to be set after installation.
* `vsc-webshark.events`: Defined **events* used for time-sync event detection (and for tree-view later).

## Known Issues

Little testing done yet.

* layout not adapting height.
* Scheme colors/options only partially used. Might not be readable/useable in some settings. I used a dark scheme during development only.
* use getState/setState instead of retainContextWhenHidden
* selected frame, ... not persisted on reopen
* pcapng support in sharkd seems limited. Some files can be opened. Some can't (e.g. test102.pcapng from pcapng-test-generator). Consider converting them first.

## Release Notes

See [Changelog](./CHANGELOG.md)

## Contributions

Any and all test, code or feedback contributions are welcome.
Open an [issue](https://github.com/mbehr1/vsc-webshark/issues) or create a pull request to make this extension work better for all.

[![Donations](https://www.paypalobjects.com/en_US/DK/i/btn/btn_donateCC_LG.gif)](https://www.paypal.com/cgi-bin/webscr?cmd=_s-xclick&hosted_button_id=2ZNMJP5P43QQN&source=url) Donations are welcome!

## Third-party Content

This project leverages the following third party content:

node-webshark
 - Source: https://github.com/QXIP/node-webshark
 - License: GPL-2.0 https://github.com/QXIP/node-webshark/blob/master/LICENSE 

 node-webshark is based on webshark by Jakub Zawadski:
 - Source: https://bitbucket.org/jwzawadzki/webshark/src/master/ 
 - License: GPL-2.0

