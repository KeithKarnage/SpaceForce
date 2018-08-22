"use strict";

// (function () {

    let socket, //Socket.IO client
        title = document.getElementById('title'),
        // btn,  //  PLAY BUTTON
        timer = 0,  //  TIMER TO MAKE SURE YOU CAN'T PRESS GO TOO OFTERN
        // game,  //  CLIENT SIDE GAME
        
        //  CANVAS AND CONTEXT
        cnv = document.createElement('canvas'),
        ctx = cnv.getContext('2d'),
        cam, cw, ch,  //  CAMERA OBJECT AND CACHED VARIABLES
        scale = 2,
        bScl = 2,  //  BASE SCALE
        dScl = 1,  //  DELTA SCALE (SCALE SUBTRACTOR)
        aScl = 2,  //  dScl - bScl
        sSpd = 0.01, //  SCALE SPEED

        //  CONTROLS
        db = document.body,
        keys = {},
        mouse = vec(-1,-1),
        touches = {},
        touchStart = [null,null],
        touchIDs = [null,null],
        _t,_tI,_tP,_tID,  //  TOUCH, TOUCH INDEX, POSITION, AND ID
        pDef = e => e.preventDefault(),
        keyH = e => {
            pDef(e);
            keys[e.keyCode] = e.type;
            if(e.type === 'keyup')
                delete keys[e.keyCode];
        },
        mouseH = e => {
            // pDef(e);
            switch(e.type) {
                case "mousedown":
                    if(!game)
                        join();
                    mouse.pressed = true;
                case "mousemove":
                    mouse.moved = true;
                    mouse.x = e.clientX/scale + cam.pos.x;
                    mouse.y = e.clientY/scale + cam.pos.y;
                break;
                case "mouseup":
                    mouse.pressed = false;
                    // mouse.x = -1;
                    // mouse.y = -1;
                break;
            }
        },
        touchH = e => {
            pDef(e);
            //  IF A GAME ISN'T INSTANTIATED
            if(!game) join();

            //  STORE AND UPDATE ALL CHANGED TOUCHES
            //  FOR EACH TOUCH
            for(_tI in e.changedTouches) {
                _t = e.changedTouches[_tI];
                _tID = _t.identifier;
                
                //  USE IDENTIFIER AS KEY IN touches
                if(_tID) {
                    //  DELETE ENDED TOUCHES
                    if(e.type === 'touchend')
                        delete touches[_tID];
                    //  ADD OR UPDATE TOUCHES
                    else touches[_tID] = _t;
                }                 
            }
            //  CLEAN UP ENDED TOUCH IDS
            //  FOR EACH TOUCH ID (2)
            touchIDs.forEach((id,i) => {
                //  IF IT ISN'T EQUAL TO NULL AND THE ID
                //  THAT IS THERE ISN'T IN touches, SET IT TO NULL
                if(id
                && !touches[id]) {
                    // console.log('setting to null')
                    touchIDs[i] = null;
                    touchStart[i] = null;
                }
            })
            //  ORGANIZE TOUCHES
            //  FOR EACH TOUCH
            for(_tI in touches) {
                _t = touches[_tI];
                _tID = _t.identifier;
                //  LEFT SIDE OF SCREEN
                // console.log(touchPos(_t),cam.w/scale/2)
                if(touchPos(_t).x < cam.w/scale/2) {
                    if(!touchIDs[0]) {
                        touchStart[0] = touchPos(_t);
                        touchIDs[0] = _tID;
                        // console.log(touchStart[0])
                    }
                //  RIGHT SIDE OF SCREEN
                } else {
                    if(!touchIDs[1]) {
                        touchStart[1] = touchPos(_t);
                        touchIDs[1] = _tID;
                    }
                }
                //  IF IT IS NOT IN touchIDs AND EITHER IS NULL
                //  IT BECOMES THE NEW FIRST OR SECOND TOUCH
                // if(touchIDs.indexOf(_tID) === -1) {
                //     if(touchIDs[0] === null)
                //         touchIDs[0] = _tID;
                //     else if(touchIDs[1] === null)
                //         touchIDs[1] = _tID;
                // }
            }
        },
        touchPos = t => {
            return vec(
                t.clientX/scale,
                t.clientY/scale
            )
        },
        displayObj = (O) => {
            ctx.fillStyle = O.fS;
            ctx.save();
            //  MOVE TO OBJECT LOCATION
            ctx.translate(O.pos.x,O.pos.y);
            //  WRITE LOCATION TO SCREEN
            ctx.fillStyle = 'black';
            ctx.fillText('  x:'+Math.floor(O.pos.x)+',y:'+Math.floor(O.pos.y)+',r:'+O.dir,0,0);
            //  ROTATE CONTEXT
            ctx.rotate(O.dir);
            //  DRAW A RECT
            // ctx.fillStyle = 'red';
            // ctx.fillRect(-O.w * 0.5,
            //                 -O.h * 0.5,
            //                 O.w,O.h);
            switch(O.type) {
                case 'player':
                case 'enemy':
                    ctx.fillStyle = O.fS;
                    ctx.beginPath();
                    ctx.moveTo(-O.w * 0.5, -O.h * 0.5);
                    ctx.lineTo(-O.w * 0.5, O.h * 0.5);
                    ctx.lineTo(O.w * 0.5, 0);
                    ctx.closePath();
                    ctx.fill();
                break;
                case 'pBullet':
                case 'eBullet':
                    O.type === 'pBullet'
                        ? ctx.fillStyle = 'green'
                        : ctx.fillStyle = 'red';
                    ctx.beginPath();
                    ctx.arc(0,0,O.w/2,0,Math.PI*2);
                    ctx.fill();
                break;
            }
            
            

            if(O.debug) {
                ctx.strokeStyle = 'rgba(20,180,70,1)';
                ctx.strokeRect(-O.w * 0.5,
                            -O.h * 0.5,
                            O.w,O.h);
            }
            //  DOT IN THE CENTRE
            ctx.fillStyle = 'black';
            ctx.fillRect(-1,-1,2,2);
            

            // if(O.children
            // && O.children.length > 0) {
            //     ctx.rotate(-O.r);
            //     // ctx.translate(
            //     //     -O.w * 0.5,
            //     //     -O.h * 0.5
            //     // );
            //     O.children.forEach(child => {
            //         displayObj(child);
            //     })
            // }

            ctx.restore();

        },
        join = e => {
            if(Date.now() - timer > 1000) {
                 //  THIS TIMER PREVENTS US FROM REQUESTING TO JOIN A GAME AFTER
                //  THE SERVER HAS ALREADY ADDED US TO A GAME, BUT BEFORE WE KNOW
                timer = Date.now();
                //  REQUEST TO JOIN A GAME
                socket.emit('join');
            }
        },
        endGame = e => {
            game.GL.stop();
            game.GL = null;
            game = null;
            ctx.fillStyle = 'rgb(20,20,20)';
            ctx.fillRect(0,0,cam.w,cam.h,cam.w,cam.h);
            socket.emit('exit');
            title.style.visibility = 'visible';

        },
        size = e => {
            setTimeout(e=>{
                cnv.width = innerWidth;
                cnv.height = innerHeight;
                ctx.fillStyle = 'rgb(20,20,20)';
                ctx.fillRect(0,0,innerWidth,innerHeight);

                 //  REUSING aScl
                aScl = cnv.width > cnv.height ? cnv.width : cnv.height;
                //  BASE SCALE IS MINIMUM OF 2
                bScl = Math.max(2,aScl/300);

                touchIDs = [null,null];
                touches = {}

                if(cam) cam.size();
            },150);
        };


    //  APPEND CANVAS TO DOCUMENT
    document.body.appendChild(cnv);
    //  RESIZE CANVAS
    size();
    //  SET IT TO RESIZE ON ORIENTATION CHANGE (MOBILE)
    addEventListener('orientationchange',size);

    //  MAKE THE CAMERA OVJECT
    cam = new Obj(null,null,0,0,cnv.width,cnv.height);
    //  HOW FAR THE CAMERA WILL MOVE THIS FRAME
    //  WE NEED TO STORE IT SO WE CAN MOVE THE MOUSE IF IT IS NOT BEING MOVED BY THE PLAYER
    cam.off = vec();
    cam.shk = vec();
    cam.shaking = false;
    cam.shake = dir => {
        // if(dir)
            // cam.shaking = 'shot';
        cam.shaking = dir ? '1' : '5';


        cam.shk.vFrD(dir).unit().scl(-5);
        // console.log(_p)
        // if(v) cam.shk.copy(v);
        // else cam.shk.copy(_p.dir).unit().scl(-1);
    };
    //  RESIZE THE CAMERA
    cam.size = e => {
        cam.w = cnv.width;
        cam.h = cnv.height;
    }
    //  FOLLOW THE PLAYER
    cam.follow = () => {
        cw = cam.w/scale;
        ch = cam.h/scale;
        _p = game.player;

        //  DELTA SCALE HAS A MAXIMUM OF 1
        //  COMBINED WITH THE BASE SCALES MINIMUM OF 2, IT NEVER GOES BELOW 1
        dScl = Math.min (_p.vel.mag()/5,1);
        //  aScl IS A TEMPORARY VARIABLE STORING THE TARGET SCALE
        aScl = bScl-dScl;
        //  IF THE SCALE IS LESS THAN THE SCALING SPEED DISTANCE FROM IT'S TARGET
        //  SET IT TO THE TARGET
        if(Math.abs(scale-aScl < sSpd))
            scale = aScl;
        else {
        //  IF THE SCALE IS LARGER THAN THE SCALING SPEED, ADD OR SUBTRACT THE SCALING SPEED
            if(scale > aScl)
                scale -= sSpd;
            else scale += sSpd;
        }

        //  THE CAM IS OFFSET IN THE DIRECTION THE PLAYER IS MOVING

        //  CAM'S TARGET COPIES THE PLAYER POSITION, SUBTRACT HALF THE CAM'S SIZE TO GET UPPER LEFT CORNER
        //  TEMPORARY VECTOR COPIES THE PLAYERS VELOCITY, SCALES IT UP TEN TIMES
        //  THEN IS ADDED TO THE CAM'S TARGET POSITION
        cam.tDir.copy(_p.pos).sub({x:cam.w/2/scale,y:cam.h/2/scale}).add(_tV.vFrD(_p.dir).scl(cam.w/8/scale));
        // console.log(_p.dir)

        //  FIND THE OFFSET BETWEEN THE CURRENT POSITION AND THE TARGET POSITION, ALSO PRIME THE MAGNITUDE
        cam.off.copy(cam.tDir).sub(cam.pos).mag();
        if(cam.off.m > 100)
            cam.off.scl(0.5);
        else if(cam.off.m > 1.5)
            cam.off.unit().scl(1.5);
        //  ADD IT TO THE CAMERA'S POSITION
        cam.off.add(game.player.vel)
        cam.pos.add(cam.off);
        //  ALSO ADD IT TO THE MOUSE'S POSITION SO THE PLAYER CONTINUES TO LOOK AT THE MOUSE,
        //  NOT THE LAST PLACE THE MOUSE WAS MOVED TO, OFFSET BY A MOVING CAMERA
        mouse.add(cam.off);

        //  ADD CAMERA SHAKE
        // switch(cam.shaking) {
        //     case 0:

        //     break;
        //     case 1:
        //     break;
        //     case 2:
        //     break;
        // }
        // console.log(cam)
        if(cam.shaking) {
            if(cam.shaking > 1) {
                cam.shk.vFrD(Math.random()*PI*2).scl(5);
                cam.shaking--;
            } else cam.shk.scl(0.5);
            if(cam.shk.mag() < 0.05
            || cam.shaking < 1)
                cam.shaking = false;
        }
        

        
        // console.log(dScl);
    };

    //  SETUP CONTROLS
    db.onkeydown = keyH;
    db.onkeyup = keyH;

    db.onmousedown = mouseH;
    db.onmousemove = mouseH;
    db.onmouseup = mouseH;

    db.ontouchstart = touchH;
    // db.ontouchmove = touchH;
    db.addEventListener('touchmove',touchH,{passive:false});
    db.ontouchend = touchH;

    /**
     * Set message text
     * @param {string} text
     */
    // function setMessage(text) {
    //     message.innerHTML = text;
    // }

   
    /**
     * Binde Socket.IO and button events
     */
    function bind() {
        // socket.on('addP', (id) => {
        //     setMessage(id);
        //     game.addPlayer(id);
        // })
        socket.on('state', S => {
            game.receiveState(S);
        });

        // socket.on('gameOver', id => {
        //     if(game) {
        //         game.removePlayer(id);
        //         endGame();
        //     }
        // })

        socket.on("connect", () => {
            // setMessage("Waiting for match...");
        });

        socket.on("joined", () => {
            // setMessage(socket.id);
            title.style.visibility = 'hidden';
            cnv.onclick = e => {};
            game = new Game(false,socket.id);

        });

        socket.on("end", () => {
            console.log('left match');
            if(game) setTimeout( endGame, 3000);
            // if(game) endGame();
            // setMessage("Match left");
        });

        socket.on("disconnect", () => {
            console.log('connection lost');
            if(game) endGame();
            // setMessage("Connection lost!");
        });

        socket.on("error", () => {
            console.log('connection error');
            // setMessage("Connection error!");
        });
    }

    /**
     * Client module init
     */
    function init() {
        socket = io({ upgrade: false, transports: ["websocket"] });

        bind();
    }

    window.addEventListener("load", init, false);

// })();
