function logPostMsg(msg) {
    console.log('logPostMsg:' + msg);
    vscode.postMessage({ message: 'logPostMsg:' + msg });
}

let sharkdReqId = 0;
sharkdCbs = new Map();

function sharkdRequest(req, cb) {
    const reqId = ++sharkdReqId;
    console.log('sharkdRequest id:' + reqId);
    sharkdCbs.set(reqId, cb);
    vscode.postMessage({ message: "sharkd req", req: req, id: reqId });
}

function sharkdResponse(res) {
    try {
        console.log('sharkdResponse id:' + res.id);
        const cb = sharkdCbs.get(res.id);
        if (cb) {
            sharkdCbs.delete(res.id);
            //var js = JSON.parse(res.res);
            cb(res.res);
        }
    } catch (err) {
        console.log('sharkdResponse err:' + err, JSON.stringify(res));
    }
}