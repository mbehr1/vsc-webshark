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