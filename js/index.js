import * as THREE from 'three';

var playeruuid = undefined;
let controls = {};
const ws = new WebSocket("ws://localhost:6942");
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 0.1, 1000 );
const renderer = new THREE.WebGLRenderer();

renderer.setSize( window.innerWidth, window.innerHeight );
document.body.appendChild( renderer.domElement );

const groundgeo = new THREE.BoxGeometry( 50, 1, 50 );
const groundmat = new THREE.MeshBasicMaterial( { color: 0x00ff00 } );
const ground = new THREE.Mesh( groundgeo, groundmat );
ground.objectID = "ground"
ground.position.y = -1
scene.add( ground );

function createPlayer(uuid) {
    var geo = new THREE.BoxGeometry( 1, 1, 1 );
    var mat = new THREE.MeshBasicMaterial( { color: 0xff0000 } );
    var obj = new THREE.Mesh( geo, mat );
    obj.objectID = uuid
    return obj;
}

function createPacket(type, data) {
    return {
        data: data,
        type: type
    }
}

function updatePos() {
    var packet = createPacket("pos", {
        x: camera.position.x,
        y: camera.position.y,
        z: camera.position.z
    })
    ws.send(JSON.stringify(packet))
}

document.addEventListener('keydown', ({ keyCode }) => { controls[keyCode] = true });
document.addEventListener('keyup', ({ keyCode }) => { controls[keyCode] = false });

window.addEventListener( 'resize', onWindowResize, false );

function onWindowResize(){
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();

    renderer.setSize( window.innerWidth, window.innerHeight );
}

ws.addEventListener("open", () =>{
    return false;
});
 
ws.addEventListener('message', (packet) => {
    packet = JSON.parse(packet.data);
    var data = packet.data;
    if (packet.type == "playeruuid") {
        playeruuid = data;
    } if (packet.type == "playerupdate") {
        let ids = scene.children.map(a => a.objectID);
        data.forEach((player) => {
            if (player.uuid !== playeruuid) {
                if (ids.includes(player.uuid)) {
                    var targetObj = scene.children[ids.indexOf(player.uuid)];
                    targetObj.position.set(player.position.x, player.position.y, player.position.z);
                    targetObj.rotation.set(player.rotation.x, player.rotation.y, player.rotation.z);
                }  else {
                    var newp = createPlayer(player.uuid);
                    scene.add(newp)
                    newp.position.set(player.position.x, player.position.y, player.position.z);
                    newp.rotation.set(player.rotation.x, player.rotation.y, player.rotation.z);
                }
            }
        })
    } if (packet.type == "playerjoin") {
        if (packet.data.uuid != playeruuid) {
            var player = createPlayer(packet.data.uuid);
            scene.add(player)
            player.position.set(0, 0, 0);
            player.rotation.set(0, 0, 0);
        }
    } if (packet.type == "playerleave") {
        let ids = scene.children.map(a => a.objectID);
        var targetObj = scene.children[ids.indexOf(data.uuid)];
        scene.remove(targetObj)
    }
});

function control() {
    if(controls[83]){ // w
      camera.position.x -= Math.sin(camera.rotation.y) * 0.1;
      camera.position.z -= -Math.cos(camera.rotation.y) * 0.1;
      updatePos()
    }
    if(controls[87]){ // s
      camera.position.x += Math.sin(camera.rotation.y) * 0.1;
      camera.position.z += -Math.cos(camera.rotation.y) * 0.1;
      updatePos()
    }
    if(controls[68]){ // a
      camera.position.x += Math.sin(camera.rotation.y + Math.PI / 2) * 0.1;
      camera.position.z += -Math.cos(camera.rotation.y + Math.PI / 2) * 0.1;
      updatePos()
    }
    if(controls[65]){ // d
      camera.position.x += Math.sin(camera.rotation.y - Math.PI / 2) * 0.1;
      camera.position.z += -Math.cos(camera.rotation.y - Math.PI / 2) * 0.1;
      updatePos()
    }
  }

function animate() {
	requestAnimationFrame( animate );

    control();

	renderer.render( scene, camera );
}

animate();