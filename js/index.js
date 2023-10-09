import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Sky } from 'three/addons/objects/Sky.js';

var playeruuid = undefined;
let controls = {};
let sky, sun;
let playerInfo = {
    height: 1.5,
    turnSpeed: .1,
    speed: .1,
    jumpHeight: .2,
    gravity: .01,
    velocity: 0,
    lerpRotation: new THREE.Vector3(),
    playerJumps: false
};
const ws = new WebSocket("ws://localhost:6942");
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 0.1, 1000 );
const renderer = new THREE.WebGLRenderer({ antialias: true });
const pointerlockcontrols = new PointerLockControls( camera, document.body );
const gltfloader = new GLTFLoader();
const light = new THREE.AmbientLight( 0xEEEEEE );
scene.add( light );
var bodyModel, headModel, armModel;

renderer.setSize( window.innerWidth, window.innerHeight );
document.body.appendChild( renderer.domElement );

pointerlockcontrols.maxPolarAngle = 3/4*Math.PI
pointerlockcontrols.minPolarAngle = 1/5*Math.PI

// Cool THREE.JS sky

sky = new Sky();
sky.scale.setScalar( 450000 );
scene.add( sky );

sun = new THREE.Vector3();

const effectController = {
    turbidity: 3.8,
    rayleigh: 3.5,
    mieCoefficient: 0.005,
    mieDirectionalG: 0.6,
    elevation: 7,
    azimuth: 180,
    exposure: renderer.toneMappingExposure
};

const uniforms = sky.material.uniforms;
uniforms[ 'turbidity' ].value = effectController.turbidity;
uniforms[ 'rayleigh' ].value = effectController.rayleigh;
uniforms[ 'mieCoefficient' ].value = effectController.mieCoefficient;
uniforms[ 'mieDirectionalG' ].value = effectController.mieDirectionalG;

const phi = THREE.MathUtils.degToRad( 90 - effectController.elevation );
const theta = THREE.MathUtils.degToRad( effectController.azimuth );

sun.setFromSphericalCoords( 1, phi, theta );

uniforms[ 'sunPosition' ].value.copy( sun );

// ##########################################

const groundgeo = new THREE.BoxGeometry( 500, 1, 500 );
const groundtexture = new THREE.TextureLoader().load('../media/ground/concrete.jpg' );

groundtexture.wrapS = groundtexture.wrapT = THREE.RepeatWrapping;

groundtexture.repeat.set( 120, 120 );

const groundmat = new THREE.MeshPhongMaterial( {
    color: 0xffffff,
    specular:0xffffff,
    shininess: 20,
    map: groundtexture,
} );
const ground = new THREE.Mesh( groundgeo, groundmat );
ground.objectID = "ground"
ground.position.y = -1
scene.add( ground );

// Loading head and body models

var scale, box, size, headElevation;

gltfloader.load(
    "../media/models/body.glb",
    function (gltf) {
        bodyModel = gltf.scene.clone(true);
        box = new THREE.Box3().setFromObject( bodyModel );
        size = new THREE.Vector3();
        box.getSize( size );
        scale = 2/size.y
        bodyModel.scale.set(scale, scale, scale);

        gltfloader.load(
            "../media/models/head.glb",
            function (gltf) {
                headModel = gltf.scene.clone(true);
                headModel.scale.set(scale, scale, scale);
                box = new THREE.Box3().setFromObject( headModel );
                size = new THREE.Vector3();
                box.getSize( size );
                headElevation = size.y;
            },
            function ( xhr ) {
            },
            function ( error ) {
                console.log( 'An error happened' );
            }
        )
        
        gltfloader.load(
            "../media/models/arms.glb",
            function (gltf) {
                armModel = gltf.scene.clone(true);
                console.log(scale)
                armModel.scale.set(scale, scale, scale);
                box = new THREE.Box3().setFromObject( armModel );
                size = new THREE.Vector3();
                box.getSize( size );
                console.log(size)
            },
            function ( xhr ) {
            },
            function ( error ) {
                console.log( 'An error happened' );
            }
        )
    },
    function ( xhr ) {
	},
	function ( error ) {
		console.log( 'An error happened' );
	}
)

// ############################

function createPlayer(uuid) {
    var p = new THREE.Object3D();
    p.objectID = uuid;

    var playerhead = headModel.clone(true)
    var playerbody = bodyModel.clone(true)
    var playerarms = armModel.clone(true)

    playerarms.position.y = -4*scale
    playerarms.position.z = 0.11

    playerhead.position.y = 1-headElevation/2

    p.add(playerhead)
    p.add(playerbody)
    p.add(playerarms)
    
    return p;
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
        y: camera.position.y+0.5,
        z: camera.position.z
    })
    ws.send(JSON.stringify(packet))
}

function updateRos() {
    var packet = createPacket("rot", {
        x: camera.rotation.x,
        y: camera.rotation.y,
        z: camera.rotation.z
    })
    ws.send(JSON.stringify(packet))
}

document.addEventListener('keydown', ({ keyCode }) => { controls[keyCode] = true });
document.addEventListener('keyup', ({ keyCode }) => { controls[keyCode] = false });
document.addEventListener("click", () => {
    pointerlockcontrols.lock()
})

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
                    targetObj.position.set(player.position.x, player.position.y-1.25, player.position.z);
                    targetObj.children[0].rotation.set(player.rotation.x, player.rotation.y, player.rotation.z);
                }  else {
                    var newp = createPlayer(player.uuid);
                    scene.add(newp)
                    newp.position.set(player.position.x, player.position.y, player.position.z);
                    newp.children[0].rotation.set(player.rotation.x, player.rotation.y, player.rotation.z);
                }
            }
        })
    } if (packet.type == "playerjoin") {
        if (packet.data.uuid != playeruuid) {
            var player = createPlayer(packet.data.uuid);
            scene.add(player)
            player.position.set(0, 1.5, 0);
            player.children[0].rotation.set(0, 0, 0);
        }
    } if (packet.type == "playerleave") {
        let ids = scene.children.map(a => a.objectID);
        var targetObj = scene.children[ids.indexOf(data.uuid)];
        scene.remove(targetObj)
    }
});

function control() {
    if(controls[83]){ // w
        pointerlockcontrols.moveForward(-playerInfo.speed)
    }
    if(controls[87]){ // s
        pointerlockcontrols.moveForward(playerInfo.speed)
    }
    if(controls[68]){ // a
        pointerlockcontrols.moveRight(playerInfo.speed)
    }
    if(controls[65]){ // d
        pointerlockcontrols.moveRight(-playerInfo.speed)
    } if(controls[32]) { // space
        if(playerInfo.jumps) return false;
        playerInfo.jumps = true;
        playerInfo.velocity = -playerInfo.jumpHeight;
    }
  }

function ixMovementUpdate() {
    playerInfo.velocity += playerInfo.gravity;
    camera.position.y -= playerInfo.velocity;
    
    if(camera.position.y < playerInfo.height) {
      camera.position.y = playerInfo.height;
      playerInfo.jumps = false;
    }
}

function animate() {
	requestAnimationFrame( animate );

    control();
    ixMovementUpdate();
    updatePos();
    updateRos();

	renderer.render( scene, camera );
}

animate();