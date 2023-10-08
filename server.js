const express = require("express")
const expressWs = require("express-ws")
const http = require("http")

let port = 6942;
let app = express();
let server = http.createServer(app).listen(port);    
let players = []

expressWs(app, server);

function createPacket(type, data) {
    return {
        data: data,
        type: type
    }
}

function uuid() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0,
        v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

function massSendPacket(packet) {
    players.forEach((websocket) => {
        websocket.send(JSON.stringify(packet))
    })
}

app.ws('/', async function(ws, req) {
    console.log("Joined")
    ws.player = {
        uuid: uuid(),
        rotation: {
            x: 0,
            y: 0,
            z: 0
        },
        position: {
            x: 0,
            y: 0,
            z: 0
        }
    }
    ws.send(JSON.stringify(createPacket("playeruuid", ws.player.uuid)))
    massSendPacket(createPacket("playerjoin", {
        uuid: ws.player.uuid
    }))

    players.push(ws)
    ws.on('message', async function(msg) {
        msg = JSON.parse(msg);
        if (msg.type == "pos") {
            ws.player.position = msg.data
        } if (msg.type == "rot") {
            ws.player.rotation = msg.data
        }

        var packet = createPacket("playerupdate", [])

        players.forEach((websocket) => {
            packet.data.push(websocket.player)
        })
        massSendPacket(packet)
    });
    ws.on("close", function(err) {
        players.splice(players.indexOf(ws), 1);
        massSendPacket(createPacket("playerleave", {
            uuid: ws.player.uuid
        }))
        console.log("Disconnected")
    })
});
