function logPostMsg(msg) {
    console.log('logPostMsg:' + msg);
    vscode.postMessage({ message: 'logPostMsg:' + msg });
}

let sharkdReqId = 2; // 1 is reserved...
sharkdCbs = new Map();

function sharkdRequest(req, cb) {
    const reqId = ++sharkdReqId;
    console.log('sharkdRequest id:' + reqId);
    sharkdCbs.set(reqId, cb);
    vscode.postMessage({ message: "sharkd req", req: req, id: reqId });
}

function sharkdResponse(res) {
    try {
        console.log(`sharkdResponse id:${res.id}: ${JSON.stringify(res).slice(0, 70)}`);
        const cb = sharkdCbs.get(res.id);
        if (cb) {
            sharkdCbs.delete(res.id);
            //var js = JSON.parse(res.res);
            if ('error' in res.res) {
                logPostMsg(`sharkdResponse got error:${JSON.stringify(res.res)}`);
                cb(res.res);
            } else { // ok, pass only the result (as with prev. sharkd version <3.5)
                cb(res.res.result);
            }
        }
    } catch (err) {
        console.log('sharkdResponse err:' + err, JSON.stringify(res));
    }
}

/// compare a wireshark version string with a reference version string
/// @param ws_vers: the version string to compare (e.g. "v4.0.10-0-gf...")
/// @param ref_vers: the reference version string (e.g. "4.1.0")
/// @return: -1 if ws_vers < ref_vers, 0 if ws_vers == ref_vers, 1 if ws_vers > ref_vers
///
/// Note: this function is not complete, it only compares the major, minor and patch version
/// Note: it assumes the ws_vers string starts with the format "vX.Y.Z"
/// todo: change to use semver lib (with webpack bundling...)
function compare_ws_version(ws_vers, ref_vers){
    if (!ws_vers.startsWith("v")) {
        console.error("compare_ws_version: invalid ws_vers string", ws_vers, ref_vers);
        return 0; // return 0 (= equal here...)
    }
    const ws_vers_parts = ws_vers.slice(1).split(".");
    const ref_vers_parts = ref_vers.split(".");
    for (let i = 0; i < ref_vers_parts.length; i++) {
        let ws_part = parseInt(ws_vers_parts[i]);
        if (isNaN(ws_part)) { ws_part = 0; }
        const ref_part = parseInt(ref_vers_parts[i]);
        if (ws_part < ref_part) { return -1; }
        if (ws_part > ref_part) { return 1; }
    }
    return 0;
}
