/* --------------------
 * Copyright(C) Matthias Behr, 2021.
 */

import { assert } from 'console';
import * as fs from 'fs';

export class DltFileWriter {
    private bufStorageHeader: Buffer;
    private fileHandle: number;
    constructor(private storageHeaderECU: string, public fsPath: string) {
        console.log(`DltFileWriter(ecu='${storageHeaderECU}' fsPath='${fsPath}')`);
        assert(storageHeaderECU.length === 4, "storageHeaderEcu length needs to be exactly 4 bytes/chars");
        this.fileHandle = fs.openSync(fsPath, 'w');
        assert(this.fileHandle > 0, "couldn't open file for writing");
        this.bufStorageHeader = Buffer.alloc(16);
        this.bufStorageHeader.writeUInt32LE(0x01544c44, 0); // DLT+0x01 (0x44 0x4c 0x54 0x01)
        this.bufStorageHeader.write(storageHeaderECU, 12, 4, "ascii"); // ECU ID
    }

    /**
     * dispose closes the file
     */
    public dispose() {
        console.log(`DltFileWriter.dispose() fileHandle=${this.fileHandle}`);
        if (this.fileHandle !== -1) {
            fs.closeSync(this.fileHandle);
            this.fileHandle = -1;
        }
    }

    /**
     * write a dlt message storage header (SH) plus raw payload from buffer
     * @param seconds seconds to use for the SH
     * @param micros microseconds to use for the SH
     * @param rawMsgData buffer with data reflecting a dlt message
     */
    public writeRaw(seconds: number, micros: number, rawMsgData: Buffer) {
        assert(this.fileHandle !== -1, "DltFileWriter.writeRaw fileHandle invalid!");
        // Timestamp: uint32 seconds sint32 micros
        this.bufStorageHeader.writeUInt32LE(seconds, 4);
        this.bufStorageHeader.writeInt32LE(micros, 8);
        fs.writeFileSync(this.fileHandle, this.bufStorageHeader);
        fs.writeFileSync(this.fileHandle, rawMsgData);
    }

}
