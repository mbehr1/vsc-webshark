# vsc-webshark README

[![Version](https://vsmarketplacebadge.apphb.com/version/mbehr1.vsc-webshark.svg)](https://marketplace.visualstudio.com/items?itemName=mbehr1.vsc-webshark)

This Visual Studio Code(tm) extension adds support to open pcap/network files.

![vsc-webshark in action](https://github.com/mbehr1/vsc-webshark/raw/master/images/vsc-webshark_1.png)

**Note:** The **time-sync** feature works well with [![Version](https://vsmarketplacebadge.apphb.com/version/mbehr1.smart-log.svg)](https://marketplace.visualstudio.com/items?itemName=mbehr1.smart-log) **smart-log** extension and [![Version](https://vsmarketplacebadge.apphb.com/version/mbehr1.dlt-logs.svg)](https://marketplace.visualstudio.com/items?itemName=mbehr1.dlt-logs) for DLT (diagnostic log and trace) files.

**Note:** It's acts mainly as a UI to a local [Wireshark&trade;](https://www.wireshark.org) installation. So Wireshark (incl **sharkd**) need to be locally installed.

**Note:** Currently I do find "sharkd" for Windows only as part of the Wireshark Win32 Portable packages [win32/WiresharkPortable_latest](https://wireshark.org/download/win32/WiresharkPortable_latest.paf.exe). Extracting the wireshark folder into any local folder and pointing the sharkdFullPath setting to it seems to work (so keeping the regular installation untouched).

**Note:** Under Linux&reg; the default Debian package doesn't install "sharkd". If you install from source (git clone https://github.com/wireshark/wireshark; cd wireshark; mkdir build; cd build; cmake -DBUILD_wireshark=OFF .. ; make ; ./run/sharkd -   <- should build sharkd and print a 'Hello from client'. The path to this binary should be sufficient. Caution might be needed on the plugin directory location. You can keep the default option -DBUILD_wireshark=ON as well but its not needed. Check the list of compile dependencies (e.g. glib-2.0-dev libpcap-dev libgcrypt20-dev lib-c-ares-dev liblua5.3-dev lua5.3 )

## Features

- Open 'pcap'/'pcapng' network capture files. Use command "open pcap file...";
- Display filter with known syntax from wireshark
- **Time sync** feature.
  - Calculates time for each frame based on timestamp and broadcasts the time to the other **Time sync** extensions so that they reveal the fitting time ranges.
  - Automatic time-sync based on freely-configurable events that get broadcasted to other extensions so that time shifts between documents are adjusted automatically. (todo add example)
- Tree-view with freely-configurable events based on display filter syntax allows to provide a kind of structure of the frames captured. Selecting an event reveals the frames close to that reception time (even the frames are not part of the current display filter).

The extension uses telemetry with one event (`open file`, errorcode as parameter) if telemetry is activated within your general configuration.

## Planned features

- Manual offset for the time via context menu item *adjust-time...*.
- If a time was received already the *adjust-time...* will propose to adjust/sync that line to the selected one.
  
## Requirements

**sharkd** binary from Wireshark needs to be locally installed. If installed via 'brew' on OSX its installed by default. For Win32/64 and Linux see notes above.

## Extension Settings

This extension contributes the following settings:

* `vsc-webshark.sharkdFullPath`: Specifies the absolute path incl filename to the sharkd binary. This needs to be set after installation.
* `vsc-webshark.events`: Defined **events** used for time-sync event detection.
  * Tree-view events need to have:
    * `level` > 0 and
    * `label` defined. The label can contain {0} for the %i info column or {1}, {2} ... replacements for the values. 
    * `displayFilter`: any Wireshark display filter expression like "tcp" or "upd or http.request"
    * `values`: array of strings referring to Wireshark column/display filters like %t or http.request:0 (take care about the :0. It's not the slice operator but the occurrence if that expression is defined by multiple protocols in the proto tree). Values can be referred to from label via {1..n}.
* Time-sync events additionally have (level and label optional):
  * `timeSyncId` providing the id for the time-sync event
  * `timeSyncPrio` defining the prio of this event. Other documents use the lowest value (=highest prio) to define which events to use for time adjustment (so whether to use just broadcast their own defined ones or in case of a timeSyncId and timeSyncValue match to adjust the time).
  * `conversionFunction` can be used to modify the time-sync value calculated for that event. Needs to be a JS function returning a string. If not used the values are concated by ' ' and if no values defined by info column.

## Known Issues

Little testing done yet.
Little documentation.

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

Linux&reg; is the registered trademark of Linus Torvalds in the U.S. and other countries.
