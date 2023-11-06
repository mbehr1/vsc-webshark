# vsc-webshark README

[![Visual Studio Marketplace Version](https://img.shields.io/visual-studio-marketplace/v/mbehr1.vsc-webshark?color=green&label=vsc-webshark&logo=visual-studio-code)](https://marketplace.visualstudio.com/items?itemName=mbehr1.vsc-webshark)

This Visual Studio Code(tm) extension adds support to open pcap/network files. It allows as well to "filter" (create smaller) pcap/pcapng files with a freely-configurable, multi-steps assistant.

![vsc-webshark in action](https://github.com/mbehr1/vsc-webshark/raw/master/images/vsc-webshark_1.png)

**Note:** The **time-sync** feature works well with [![Visual Studio Marketplace Version](https://img.shields.io/visual-studio-marketplace/v/mbehr1.smart-log?color=green&label=smart-log&logo=visual-studio-code)](https://marketplace.visualstudio.com/items?itemName=mbehr1.smart-log) extension and [![Visual Studio Marketplace Version](https://img.shields.io/visual-studio-marketplace/v/mbehr1.dlt-logs?color=green&label=dlt-logs&logo=visual-studio-code)](https://marketplace.visualstudio.com/items?itemName=mbehr1.dlt-logs) for DLT (diagnostic log and trace) files.

**Note:** It acts mainly as a UI to a local [Wireshark&trade;](https://www.wireshark.org) installation. So Wireshark (incl **sharkd**) need to be locally installed.

>**Note:** Wireshark changed the jsonrpc for sharkd with version 3.5. This version requires a wireshark installation **>=v3.5**! If you need an older wireshark version you need to use v1.7.1 of this extension!

>**Note:** Currently I do find "sharkd" for Windows only as part of the Wireshark Portable packages [win64/WiresharkPortable_latest](https://www.wireshark.org/download/win64/WiresharkPortable64_latest.paf.exe). Extracting the wireshark folder into any local folder and pointing the sharkdFullPath setting to it seems to work (so keeping the regular installation untouched).

>**Note:** Under Linux&reg; the default Debian package doesn't install "sharkd". 
With Ubuntu 20.04-LTS installing package "tshark" seems to be sufficient.

If you install from source (git clone https://github.com/wireshark/wireshark; cd wireshark; mkdir build; cd build; cmake -DBUILD_wireshark=OFF .. ; make ; ./run/sharkd -   <- should build sharkd and print a 'Hello from client'. The path to this binary should be sufficient. Caution might be needed on the plugin directory location. You can keep the default option -DBUILD_wireshark=ON as well but its not needed. Check the list of compile dependencies (e.g. glib-2.0-dev libpcap-dev libgcrypt20-dev lib-c-ares-dev liblua5.3-dev lua5.3 )

## Features

- Open 'pcap'/'pcapng' network capture files. Use command "Open pcap file..." or with vscode >=1.46 directly open cap/pcap/pcapng files.
- Display filter with known syntax from wireshark
- **Time sync** feature.
  - Calculates time for each frame based on timestamp and broadcasts the time to the other **Time sync** extensions so that they reveal the fitting time ranges.
  - Automatic time-sync based on freely-configurable events that get broadcasted to other extensions so that time shifts between documents are adjusted automatically. (todo add example)
  - Manual offset for the time via context menu item *adjust-time...*.
  - If a time was received already the *adjust-time...* will propose to adjust/sync the selected line to the received one.
- Tree-view with freely-configurable events based on display filter syntax allows to provide a kind of structure of the frames captured. Selecting an event reveals the frames close to that reception time (even the frames are not part of the current display filter).
- **Filter pcap files** assistant (mainly to reduce size and ease further analysis). Use command "Filter pcap file...". This generates and executes Wireshark-tshark based filter expressions and executes them to create a new pcap files with only the filter matching frames. The steps are fully configurable. The default settings provide filter on MAC addresses, udp dest ports, tcp dest ports and an additional filter expression.
- **Extract DLT from pcap** assistant that allows to extract DLT files directly from pcap files. Use command "Extract DLT from pcap file...". Multiple methods can be configured. By default two are available: 
  - **UDP DLT**: select/confirm the UDP port and choose the devices/MAC addresses that sent the DLT data,
  - **TECMP UART/RS232_RAW**: converts serial DLT traces that are TECMP encapsulated (e.g. from Technica logger).
- **Merge pcap files** i.e. allow to use multiple input pcap files for **Filter pcap** and **Extract DLT**. The input files will be passed to mergecap tool first and merged based on frame timestamps.

The extension uses telemetry with two events (`open file`, errorcode as parameter or `filter pcap`) if telemetry is activated within your general configuration.

## Planned features

- make it look nicer / more compliant to schema.
- indicate running background tasks

## Requirements

**sharkd** (and tshark) binary from Wireshark >=v3.5 needs to be locally installed. If installed via 'brew' on OSX its installed by default. For Win32/64 and Linux see notes above.

## Extension Settings

This extension contributes the following settings:

* `vsc-webshark.sharkdFullPath`: Specifies the absolute path incl filename to the sharkd binary. This needs to be set after installation.
* `vsc-webshark.tsharkFullPath`: Specifies the absolute path incl filename to the tshark binary. Defaults to 'tshark'. Needs to be set after installation if tshark is not reachable via search path.
* `vsc-webshark.mergecapFullPath`: Specifies the absolute path incl filename to the mergecap binary. Defaults to 'mergecap'. Needs to be set after installation if mergecap is not reachable via search path.
* `vsc-webshark.wiresharkProfile`: Specifies the name of an (installed) [wireshark profile](https://www.wireshark.org/docs/wsug_html_chunked/ChCustConfigProfilesSection.html).
* `vsc-webshark.columns`: Defines the columns shown. Uses the format strings as defined e.g. here [wireshark github](https://github.com/wireshark/wireshark/blob/66accecf3e8530647937b094fb3c9a3b93dfa28e/epan/column.c#L33) (see readable strings a few lines [below](https://github.com/wireshark/wireshark/blob/66accecf3e8530647937b094fb3c9a3b93dfa28e/epan/column.c#L120)). If not provided default values are used.
* `vsc-webshark.columnsWidths`: Defines the width for the columns. If not provided default values are used.
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
* `vsc-webshark.filterSteps`: defines the configurable steps of the "filter pcap file..." assistant. See the default/configuration for an example. (Todo: provide a full description). Please consider using "-C <config-name>" in filterArgs and listProvider to use tshark with a minimal configuration (only the plugins activated that you do need for the used filters) to speed up processing significantly. The configuration allows to use multiple steps and chained/piped filters to start with a minimal config and use your default config with more complex plugins/filter expressions (e.g. someip/someipsd plugin) in later steps.
* `vsc-webshark.extractDltMethods`: Array with the different methods offered for extracting DLT from PCAP files. By default two methods are configured:
  * UDP DLT
  * TECMP UART/RS232_RAW encapsulated.
  Each method consists of: 
  * `name`: a name to identify
  * `steps`: similar to filterSteps but for the "extract DLT from pcap file..." function.
  * `tSharkArgs`: arguments used for tshark to extract the DLT message payload from the pcap file.


## Known Issues

* wireshark/sharkd versions before v4.0.5 fail with deprecated filters. See https://gitlab.com/wireshark/wireshark/-/issues/18886. Don't enter deprecated filter expression as this stops further processing for that file. Please update to >= v4.0.5.

Little testing done yet.
Little documentation.

* layout not adapting height.
* Scheme colors/options only partially used. Might not be readable/useable in some settings. I used a dark scheme during development only.
* use getState/setState instead of retainContextWhenHidden
* selected frame, ... not persisted on reopen
* pcapng support in sharkd seems limited. Some files can be opened. Some can't (e.g. test102.pcapng from pcapng-test-generator). Consider converting them first.

## Release Notes

See [Changelog](./CHANGELOG.md)

[![semantic-release](https://img.shields.io/badge/%20%20%F0%9F%93%A6%F0%9F%9A%80-semantic--release-e10079.svg)](https://github.com/semantic-release/semantic-release)
![release](https://github.com/mbehr1/vsc-webshark/workflows/Semantic%20Release%20and%20Publish/badge.svg)

## Contributions

Any and all test, code or feedback contributions are welcome.
Open an [issue](https://github.com/mbehr1/vsc-webshark/issues) or create a pull request to make this extension work better for all.

[![Donations](https://www.paypalobjects.com/en_US/DK/i/btn/btn_donateCC_LG.gif)](https://www.paypal.com/cgi-bin/webscr?cmd=_s-xclick&hosted_button_id=2ZNMJP5P43QQN&source=url) Donations are welcome!

[GitHub ♥︎ Sponsors are welcome!](https://github.com/sponsors/mbehr1)

## Third-party Content

This project leverages the following third party content:

node-webshark
 - Source: https://github.com/QXIP/node-webshark
 - License: GPL-2.0 https://github.com/QXIP/node-webshark/blob/master/LICENSE 

 node-webshark is based on webshark by Jakub Zawadski:
 - Source: https://bitbucket.org/jwzawadzki/webshark/src/master/ 
 - License: GPL-2.0

Linux&reg; is the registered trademark of Linus Torvalds in the U.S. and other countries.
