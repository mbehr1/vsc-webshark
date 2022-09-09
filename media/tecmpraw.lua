-- poc / very basic dissector allow access to the TECMP encaps. packet data
-- (c) Matthias Behr, 2021-2022

-- create myproto protocol and its fields
local p_tecmpraw = Proto("tecmpraw", "TECMP raw payload dissector by mbehr1");

--local f_command = ProtoField.uint16("tecmpraw.command", "Command", base.HEX)
local f_data = ProtoField.new("tecmpraw.data", "rawdata", ftypes.BYTES)

p_tecmpraw.fields = {f_data}

local eth_table = DissectorTable.get("ethertype")
-- local tecmp_dis = DissectorTable.get("ip.proto") -- ip.proto geht, tecmp nicht...
local tecmp_dis = eth_table:get_dissector(0x99fe) -- ip.proto geht, tecmp orig ethertype 0x99fe

-- fields we do access from the orig tecmp:
-- declare the fields we need to read
local f_data_type = Field.new("tecmp.data_type") -- expect 0x0080 Ethernet II
local f_payload_length    = Field.new("tecmp.payload.length")

function p_tecmpraw.dissector (buf, pkt, root)
    if buf:len() == 0 then return end

    tecmp_dis:call(buf,pkt,root)
    data_type = f_data_type().value
    if (data_type == 0x00000080) then
        -- print("\nfound data_type:", data_type)

        buf_len =buf:len()
        payload_length = f_payload_length().value -- not needed with tecmp 3.4.9 or higher +4
        -- print("\n tecmp.payload.length:", payload_length, " buf:len()=", buf_len)

        -- return as raw data the last payload_length part:
        --  pkt.cols.protocol = p_tecmpraw.name
        subtree = root:add(p_tecmpraw, buf(0))
        -- add protocol fields to subtree
        subtree:add(f_data, buf(buf_len-payload_length,payload_length))
    end
end

-- set ourself as new dissector for default tecmp as well
eth_table:set(0x99fe, p_tecmpraw)

-- subscribe for Ethernet packets on type 8336 (0x2090).
eth_table:add(8336, p_tecmpraw)
