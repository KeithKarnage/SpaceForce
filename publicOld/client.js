"use strict";

// (function () {

    let socket, //Socket.IO client
    message = 'test',
        title = document.getElementById('title'),
        randBtn = document.getElementById('random'),
        playBtn = document.getElementById('play'),
        // btn,  //  PLAY BUTTON
        timer = 0,  //  TIMER TO MAKE SURE YOU CAN'T PRESS GO TOO OFTERN
        // game,  //  CLIENT SIDE GAME
        
        //  CANVAS AND CONTEXT
        cnv = document.createElement('canvas'),
        ctx = cnv.getContext('2d'),


        // buffer = document.createElement('canvas'),
        // bCtx = buffer.getContext('2d'),
        Canvas = (w,h) => {
            let img = document.createElement('canvas');
            img.ctx = img.getContext('2d');
            img.width = w;
            img.height = h;
            return img;
        },
        _ctx,  //  CACHED VARIABLE FOR WORKING WITH IMAGES
        _c,  //  CACHED COLOUR VARIABLE
        images = {
            sprites: Canvas(128,128),
            stars: Canvas(512,512)
        },


        cam, cw, ch,  //  CAMERA OBJECT AND CACHED VARIABLES
        scale = 2,
        bScl = 2,  //  BASE SCALE
        dScl = 1,  //  DELTA SCALE (SCALE SUBTRACTOR)
        aScl = 2,  //  dScl - bScl
        sSpd = 0.01, //  SCALE SPEED

        //  v,count,w,h,angle,life,blend
        particles = {
            thruster: [-0.5,1,5,8, 0.2,500,[6,5,4,4]],
            splosion: [ 0.6,8, 12,12,PI*2,300,[3,3,2,15,15,10,7]],
            bullet: [ -1,2, 4,4,PI/3,200,[15,14,13,13,7,0]]
        },
        particlePool = ObjectPool(Obj),
        _P,_ppI, _pV = vec(),
        _pD,  //  PARTICLE DATA
        emitParticle = (loc,dir,prt,vel = 0) => {
            _pD = particles[prt];
            for(_ppI=0; _ppI<_pD[1]; _ppI++) {
            dir = dir - _pD[4]/2 + Math.random()*_pD[4];
                _pV.vFrD(dir).scl(_pD[0]+vel);

                _P = {
                    type: 'particle',
                    name: prt,
                    x: loc.x,
                    y: loc.y,
                    vx: _pV.x,
                    vy: _pV.y,
                    w: _pD[2],
                    h: _pD[3],
                    //  angle
                    dir: _pV.dir(),
                    
                    life: _pD[5],
                    //  REUSE sprite TO HOLD COLOUR SEQUENCE FOR PARTICLE
                    sprite: _pD[6]
                };
                particlePool.newObject(_P);
            };
            
            
        },
        updateParticle = (ts,p) => {
            p.life -= ts;
            if(p.life < 0)
                p.release();
            p.pos.add(p.vel);
            //  REUSE acc [ACCELERATION] TO KEEP TRACK OF LIFE 0-1
            p.acc = p.life/p.mLife;
        },
        stars = [],

        //  CONTROLS
        db = document.body,
        keys = {},
        mouse = vec(-1,-1),
        touches = {},
        touchStart = [null,null],
        touchIDs = [null,null],
        _t,_tI,_tP,_tID,  //  TOUCH, TOUCH INDEX, POSITION, AND ID
        keyH = e => {
            e.preventDefault();
            keys[e.keyCode] = e.type;
            if(e.type === 'keyup')
                delete keys[e.keyCode];
        },
        mouseH = e => {
            // e.preventDefault();
            switch(e.type) {
                case "mousedown":
                    if(!audioCtx) {
                        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
                        startAudio()
                    };
                    if(!game)
                        join(e);
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
            e.preventDefault();

            if(!audioCtx) {
                audioCtx = new (window.AudioContext || window.webkitAudioContext)();
                startAudio()
                // console.log(audioCtx);
            };
            //  IF A GAME ISN'T INSTANTIATED
            if(!game && e.type !== 'touchend') join(e);

            //  STORE AND UPDATE ALL CHANGED TOUCHES
            //  FOR EACH TOUCH
            message = null;

                // console.log(e)
            for(_tI in e.changedTouches) {
                

                _t = e.changedTouches[_tI];
                _tID = _t.identifier;
                // message = _t[0];
                
                //  USE IDENTIFIER AS KEY IN touches
                // console.log(_tID)
                if(_tID || _tID === 0) {
                    // console.log('tID',_tID)

                    //  DELETE ENDED TOUCHES
                    if(e.type === 'touchend')
                        delete touches[_tID];
                    //  ADD OR UPDATE TOUCHES
                    else touches[_tID] = _t
                }                 
            };
            //  CLEAN UP ENDED TOUCH IDS
            //  FOR EACH TOUCH ID (2)
            touchIDs.forEach((id,i) => {
                //  IF IT ISN'T EQUAL TO NULL AND THE ID
                //  THAT IS THERE ISN'T IN touches, SET IT TO NULL
                if(id !== null
                && !touches[id]) {
                    // console.log('setting to null')
                    touchIDs[i] = null;
                    touchStart[i] = null;
                }
            });
            //  ORGANIZE TOUCHES
            //  FOR EACH TOUCH
            for(_tI in touches) {
                _t = touches[_tI];
                _tID = _t.identifier;
                //  LEFT SIDE OF SCREEN
                if(touchPos(_t).x < cam.w/scale/2) {

                    if(touchIDs[0] === null) {
                        touchStart[0] = _t;
                        touchIDs[0] = _tID;
                    }
                //  RIGHT SIDE OF SCREEN
                } else {

                    if(touchIDs[1] === null) {
                        touchStart[1] = _t;
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
        resetTouches = t => {
            touches = {};
            touchIDs = [null,null];
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
            // ctx.fillStyle = 'black';
            // ctx.fillText('  x:'+Math.floor(O.pos.x)+',y:'+Math.floor(O.pos.y)+',r:'+O.dir,0,0);
            //  ROTATE CONTEXT
            ctx.rotate(O.dir);
            //  DRAW A RECT
            // ctx.fillStyle = 'red';
            // ctx.fillRect(-O.w * 0.5,
            //                 -O.h * 0.5,
            //                 O.w,O.h);
            switch(O.type) {
                
                case 'enemy':
                // ctx.fillStyle = 'white';
                // ctx.fillText(O.id,10,0)
                case 'player':
                
                
                // console.log(O.hurt);
                    ctx.rotate(PI/2);
                    ctx.drawImage(images[O.sprite],
                                    0,
                                    O.hurt !== false ? 48 : 0,
                                    32,32,
                                    -O.w/2-4,
                                    -O.h/2-4,
                                    32,32);
                break;
                case 'cargo':
                    ctx.rotate(PI/2);
                    ctx.drawImage(images[O.sprite],
                                    0,
                                    O.hurt !== false ? 48 : 0,
                                    32,47,
                                    -O.w/2+2,
                                    -O.h/2-6,
                                    32,47);
                    //  DRAWS COLLISION CIRCLE
                    // ctx.fillStyle = 'rgba(255,0,0,0.3)';
                    // ctx.beginPath();
                    // ctx.arc(0,0,O.w/2,0,Math.PI*2);
                    // ctx.fill();
                break;
                case 'pBullet':
                case 'eBullet':
                    // O.type === 'pBullet'
                    //     ? ctx.fillStyle = 'green'
                    //     : ctx.fillStyle = 'red';
                    // ctx.beginPath();
                    // ctx.arc(0,0,O.w/2,0,Math.PI*2);
                    // ctx.fill();
                    // console.log(O.w);
                    ctx.drawImage(images.sprites,
                                    0,
                                    16*(O.w/2-2),
                                    16,16,
                                    -8,-8,
                                    16,16);
                    
                    // ctx.fillStyle = 'lightgreen';
                    // ctx.fillText(O.id,0,0)
                break;
                case 'particle':
                    ctx.globalAlpha = O.acc;
                    ctx.globalCompositeOperation =  'screen';

                    // if(O.blend)
                        // ctx.globalCompositeOperation =  O.blend;
                    ctx.fillStyle = colours[O.sprite[O.acc*O.sprite.length|0]];
                    // console.log(O.sprite)
                    switch(O.name) {
                        case 'splosion':
                        case 'bullet':
                            // ctx.fillStyle = 'red';
                    // ctx.globalCompositeOperation =  'screen';

                            ctx.beginPath();
                            ctx.arc(0,0,O.w/2,0,Math.PI*2);
                            ctx.fill();
                        break;
                        case 'thruster':
                            // ctx.fillStyle = 'blue';
                            ctx.fillRect(-O.w/2,-O.h/2,O.w,O.h);
                        break;
                    };
                    
                break;
                case 'star':
                    ctx.drawImage(images.sprites,27,81,4,4,-2,-2,4,4);
                break;
            };
            
            
            

            if(O.debug) {
                ctx.strokeStyle = 'rgba(20,180,70,1)';
                ctx.strokeRect(-O.w * 0.5,
                            -O.h * 0.5,
                            O.w,O.h)
            };
            //  DOT IN THE CENTRE
            // ctx.fillStyle = 'black';
            // ctx.fillRect(-1,-1,2,2);

            ctx.restore();

        },
        join = e => {
            if(!audioCtx) return;
            // console.log(mouse.x, innerWidth/scale/2);
            if((e.touches && touchPos(e.touches[0]).x > innerWidth/scale/2)
            || touchPos(e).x > innerWidth/scale/2) {
                if(Date.now() - timer > 1000) {
                     //  THIS TIMER PREVENTS US FROM REQUESTING TO JOIN A GAME AFTER
                    //  THE SERVER HAS ALREADY ADDED US TO A GAME, BUT BEFORE WE KNOW
                    timer = Date.now();
                    //  REQUEST TO JOIN A GAME
                    socket.emit('join',_ship);
                }
            //  RANDOMIZE SHIP
            } else {
                randomPlayer()
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
            randBtn.style.visibility = 'visible';
            playBtn.style.visibility = 'visible';
            randomPlayer()

        },
        size = e => {
            setTimeout(e=>{
                cnv.width = innerWidth;
                cnv.height = innerHeight;
                ctx.fillStyle = 'rgb(20,20,20)';
                ctx.fillRect(0,0,innerWidth,innerHeight);
                ctx.imageSmoothingEnabled = false;


                

                 //  REUSING aScl
                aScl = cnv.width > cnv.height ? cnv.width : cnv.height;
                //  BASE SCALE IS MINIMUM OF 2
                bScl = Math.max(2,aScl/360);
                resetTouches();
                // touchIDs = [null,null];
                // touches = {}

                if(cam) cam.size();
                randomPlayer()
            },150);
        },
        colours = [
            //  WHITE PALETTE
            '#fff',     //  0 - WHITE
            '#b2dcef',  //  1 - LIGHT BLUE GREY
            '#9d9d9d',  //  2 - GREY
            '#2f484e',  //  3 - DARK GREY

            //  BLUE PALETTE
            // '#b2dcef',  //  1 - LIGHT BLUE GREY
            '#31a2f2',  //  4 - LIGHT BLUE
            '#005784',  //  5 - BLUE
            '#1b2632',  //  6 - DARK BLUE

            //  GREEN PALETTE
            '#f7e26b',  //  7 - YELLOW
            '#a3ce27',  //  8 - GREEN
            '#44891a',  //  9 - DARK GREEN
            // '#2f484e',  //  3 - DARK GREY

            //  ORANGE PALETTE
            // '#f7e26b',  //  7 - YELLOW
            '#eb8931',  //  10 - ORANGE
            '#a46422',  //  11 - LIGHT BROWN
            '#493c2b',  //  12 - BROWN

            //  RED PALETTE
            '#fad5ee',     //  13 - LIGHT PINK
            '#e06f8b',  //  14 - PINK
            '#be2633',  //  15 - RED
            // '#493c2b',  //  12 - BROWN

            //  BLACK
            '#141414',  //  16 - BLACK

        ],
        graphs = [
            [ , ,3,2,  , , ,6,  , ,3,2,  , ,7,6,   , ,3,6,         , ,3,1, 3,3,3,2, 3,3,2,2, 3,3,2,2, 2,2,1,1,         , , ,3,  , , ,3,  , , ,3,  , ,3,3,  ,3,3,3,       ,8,8,8, 3,1,2,1, 8,3,3,1, 8,3,3,2,  ,8,2,1,      ,2,1,0],
            [ , ,3,0,  ,3,7,5,  ,3,2,1,  ,7,6,5,   ,3,2,5,         , ,3,0, 2,3,2,1, 3,2,1,0, 2,2,1,2, 2,1,0,0,         , ,3,1,  , ,3,2,  , ,3,2,  ,3,2,1, 3,2,2,3,      8,8,8,3, 3,2,1,0, 8,8,8,2, 8,8,3,1,  , ,3,3,      , ,2,1],
            [ ,3,2,0, 3,2,6,4, 3,2,1,5,  ,7,5,4,   ,3,1,4,         ,3,2,0, 1,3,1,0, 2,1,0,0, 3,1,0,2, 1,0,1,1,         ,3,1,1,  ,3,1,3,  ,3,2,1, 3,2,0,2, 3,2,1,1,      8,3,2,1,  ,8,2,0, 8,3,1,2, 8,2,3,1,  , ,8,2,      , , ,2],
            [ ,3,1,6, 2,1,6,5, 3,0,5,4, 7,6,6,6,  3,2,0,5,        3,2,1,0, 1,2,3,0, 2,1,0,0, 1,0,0,2, 1,0,1,1,        3,0,1,1, 3,1,2,2, 3,2,1,1, 2,1,0,3, 3,2,1,2,      8,8,8,3, 8,3,3,2, 8,8,2,8,  , , ,2,  , ,8,3,      , , , ],
            [3,2,2,5, 3,3,1,0, 3,1,6,1, 7,6,5,1,  3,2,1,6,        3,1,1,1, 1,2,1,2, 3,1,2,1, 3,2,2,2, 1,0,1,1,        3,1,2,1, 2,2,2,1, 3,2,1,0, 2,1,0,3, 3,3,2,1,      8,3,2,1, 8,8,3,1,  , ,3, ,  , , ,3 ],
            [3,1,7,4, 2,1,2,6, 3,3,2,0, 3,2,3,2,   ,3,2,5,        3,3,2,1, 2,2,1,0, 3,2,3,0, 1,0,0,0, 1,0,1,1,        3,1,3,3, 2,2,1,3, 3,2,1,0, 3,2,1,3, 3,2,0,1,       ,8,8,3, 8,2,3,1,  , ,3 ],
            [3,0,7,6, 2,1,2,5, 3,2,2,1, 3,2,1,0,  3,2,1,6,        3,1,2,0, 2,2,1,1, 2,3,2,1, 2,1,0,1, 2,1,0,0,        3,3, , , 3,3,2,2, 3,2,1,0,  ,3,2,3, 3,2,0,0,       ,8,3,2,  , , ,2,  , ,3 ],
            [ ,3,1,7,  ,3,2,1,  ,3,1,2,  ,3,2,1,   ,3,2,7,        3,2,3,2, 3,3,2,1, 2,2,3,3, 3,2,2,3, 2,2,1,1,         , , , ,  , ,3,3,  ,3,2,2,  , ,3,3,  ,3,2,2,       ,8,3,2,  , , ,3,  , ,8 ]
        ],
        _g,_x,_y,_plt,
        
        palettes = [
            //  0 - WHITE SHIPS
            [0,1,2,3,1,4,5,6,6],
            //  1 - BLUE SHIP
            [1,4,5,6,7,10,11,12,6],
            //  2 - ORANGE SHIP
            [7,10,11,12,0,7,8,3,6],
            //  3 - GREEN SHIP
            [7,8,9,3,0,14,15,12,6],
            //  4 - RED SHIP
            [13,14,15,12,1,4,5,6,6],
            //  5 - DAMAGED WHITE SHIPS
            [1,1,0,0,1,1,0,0,0],
            [0,0,1],
            [0,1],
            [4],
            [5],
            [1],
            [0]

        ],
        //  o[0] = x
        //  o[1] = y
        //  o[2] = panel
        //  o[3] = palette
        //  o[4] = flip x, undefined = NO, number = OFFSET
        //  o[5] = flip y
        graph = (c,o) => {
            // console.log(o)
            _g = graphs;
            _plt = palettes[o[3]];
            c.save();
            c.translate(o[0],o[1]);
            for(_y=0; _y<8; _y++) {
                for(_x=0; _x<4; _x++) {
                    _c = _x+o[2]*4;
                    if(_g[_y]
                    && (_g[_y][_c] || _g[_y][_c]===0)) {
                        // console.log(_plt[_g[_y][_c]],c.fillStyle)
                        _c = _plt[_g[_y][_c]];
                        if(_c || _c === 0) {
                            c.fillStyle = colours[_c];
                            // console.log(_plt[_g[_y][_c]],c.fillStyle)
                            if(!o[5])
                                c.fillRect(_x,_y,1,1);
                            else c.fillRect(_x,7-_y,1,1);
                            if(o[4] || o[4]===0) {
                                if(o[5])
                                    c.fillRect(7-_x+o[4],7-_y,1,1);
                                else c.fillRect(7-_x+o[4],_y,1,1);
                            }
                        }
                    }
                }
            };
            c.restore();
        },
        circles = (x,c) => {
            _ctx = images.sprites.ctx;
            for(_iI=0; _iI<5; _iI++) {
                for(_i=0; _i<2; _i++) {
                    _ctx.fillStyle = colours[c[_i]];
                    _ctx.beginPath();
                    _ctx.arc(16*x+8,64-_iI*16+8,6-_iI-_i,0,Math.PI*2);
                    _ctx.fill();
                }    
            };
            //  ARROWS AND STARS
            for(_i=0; _i<5; _i++) {
                //  ARROWS
                graph(_ctx,[2 + _i*8,82,20,_i,-1]);
                //  STARS
                graph(_ctx,[2 + _i*8,90,20,_i+7,-1]);
                if(_i == 0)
                    graph(_ctx,[2 + _i*8,83,20,7,-1,1]);

            };
            //  DRAW STAR FIELD
            for(_i=0; _i<32; _i++) {
                for(_iI=0; _iI<32; _iI++) {
                        _o = [ Math.random()*5|0,
                                Math.random()*28|0 + 32*_i,
                                Math.random()*28|0 + 32*_iI];
                        _ctx = images.stars.ctx;
                        // console.log(_o)
                        _ctx.drawImage(images.sprites,8+8*_o[0],90,8,8,_o[1],_o[2],8,8);
                    // }
                    // stars.push(star);
                    // console.log(star.pos);
                }
            };
            
        },
        addShip = s => {
            images[s] = Canvas(64,96);
            if(s[5]) {
                drawCargo(images[s].ctx,0,0,s[4]||0,s);
                drawCargo(images[s].ctx,0,48,5,s)
            } else {
                drawShip(images[s].ctx,0,0,s[4]||0,s);
                drawShip(images[s].ctx,0,48,5,s)
            }


            // bCtx.drawImage(images[s],0,0);
        },
        //  p = PALETTE
        //  INDEX FOR PALETTES LIST
        //  s = SHIP STYLE
        //  s[0] = COCKPIT
        //      0-4, 0 IS COMMON ENEMY, 1-3 IS PLAYERS, 4 IS CARGO SHIPS
        //  s[1] = BODY
        //      0-4, 0 IS COMMON ENEMY AND CAN BE FLIPPED, 1-3 IS PLAYERS AND CARGO, 1-4 IS CARGO
        //  s[2] = WINGS
        //      0-4 NORMAl, 5-9 FLIPPED, ALL AVAILABLE TO COMMONE ENEMY AND PLAYER, 2-4 AVAILABLE TO CARGO
        //  s[3] = THRUSTERS
        //      0-4,  0 IS CARGO, 1-3 IS PLAYERS, 4 IS COMMON ENEMY
        drawShip = (c,x,y,p,s) => {

            //  COCKPIT
            graph(c,[x+8,y,s[0],p,0]);
            //  BODY
            graph(c,[x+8,y+8,5+s[1]%5,p,0,(s[1]>5?1:0)]);
            //  WINGS
            graph(c,[x+4,y+8,10+s[2]%5,p,8,(s[2]>5?1:0)]);
            //  THRUSTERS
            graph(c,[x+8,y+16,15+s[3]*1,p,0]) 
        },
         drawCargo = (c,x,y,p,s) => {
            graph(c,[x+8,y,4,p,0]);
            graph(c,[x+8,y+8,6,p,0]);
            graph(c,[x+8,y+16,9,p,0]);
            graph(c,[x+8,y+24,7,p,0]);
            graph(c,[x+8,y+32,15,p,0]);
            // console.log(s[0]+12)
            graph(c,[x+4,y+8,1*s[1]+12,p,8]);
            graph(c,[x+4,y+16,1*s[2]+6,p,8]);
            graph(c,[x  ,y+16,1*s[3]+12,p,16]);
            graph(c,[x+4,y+24,1*s[5]+12,p,8,1])
        },
        randomPlayer = e => {
            randomShip(0);
            ctx.save();
            ctx.fillRect(0,0,cnv.width,cnv.height);
            ctx.drawImage(images.stars,0,0,512,512,0,0,1024,1024);
            ctx.translate(cnv.width/2|0,0);
            ctx.scale(6,6);
            // randomShip(2)
            // drawCargo(ctx,-20,cnv.height/scale/12|0,_ship[4]||0,_ship);

            drawShip(ctx,-20,cnv.height/scale/12|0,_ship[4]||0,_ship);
            // console.log(_ship[0]);
            for(_i=0; _i<_ship[0]; _i++)
                ctx.drawImage(images.sprites,0,(_ship[0]==1?4:(_ship[0]==2?1:0))*16,16,16,0,(cnv.height/scale/14|0)+8*_i,16,16);
            ctx.font = '2px futura';
            ctx.textAlign = 'center';
            //  DrAW METERS WITH LABELS FOR SHIP STATS
            ['Armour','Accel','Turn'].forEach((k,i) => {
                ctx.fillStyle = colours[3];
                ctx.fillRect(-5,cnv.height/scale/5+4*i,10,2.5);
                // console.log(shipStats(_ship)[i]/mStats[i])
                ctx.fillStyle = colours[8];
                ctx.fillRect(-5,cnv.height/scale/5+4*i,10*shipStats(_ship)[i]/mStats[i],2.5);

                ctx.fillStyle = colours[0];
                ctx.fillText(k,0,cnv.height/scale/5+4*i+2)  
            });
            
            ctx.restore();
        };
// localStorage.clear();

    //  APPEND CANVAS TO DOCUMENT
    document.body.appendChild(cnv);
    //  RESIZE CANVAS
    size();
    //  SET IT TO RESIZE ON ORIENTATION CHANGE (MOBILE)
    addEventListener('orientationchange',size);



    setTimeout(randomPlayer,200);

    circles(0,[1,0]);
    



    //  MAKE THE CAMERA OVJECT
    cam = new Obj(null,null,0,0,cnv.width,cnv.height);
    cam.bg = [];
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
        cam.h = cnv.height
    };
    cam.offScreen = o => {
        if(o.pos.x + o.w/2 < cam.pos.x
        || o.pos.x - o.w/2 > cam.pos.x + cam.w/scale
        || o.pos.y + o.w/2 < cam.pos.y
        || o.pos.y - o.w/2 > cam.pos.y + cam.h/scale)
            return true;
        else return false
    };

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
        };

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
        cam.off.add(game.player.vel);
        cam.pos.add(cam.off);
        //  ALSO ADD IT TO THE MOUSE'S POSITION SO THE PLAYER CONTINUES TO LOOK AT THE MOUSE,
        //  NOT THE LAST PLACE THE MOUSE WAS MOVED TO, OFFSET BY A MOVING CAMERA
        mouse.add(cam.off);

        //  ADD CAMERA SHAKE
        if(cam.shaking) {
            if(cam.shaking > 1) {
                cam.shk.vFrD(Math.random()*PI*2).scl(5);
                cam.shaking--;
            } else cam.shk.scl(0.5);
            if(cam.shk.mag() < 0.05
            || cam.shaking < 1)
                cam.shaking = false;
        };

        //  UPDATE LOCATIONS OF BACKGROUND IMAGE
        cam.bg = [];
        
        _X = cam.pos.x > 0 ? cam.pos.x%512 : 512 - (-cam.pos.x%512);
        _Y = cam.pos.y > 0 ? cam.pos.y%512 : 512 - (-cam.pos.y%512);
        _W = Math.min(cw,512-_X);
        _H = Math.min(ch,512-_Y);
        cam.bg.push([_X,_Y,_W,_H]);
        if(_W < cw)
            cam.bg[1] = [0,_Y,cw-_W,_H,_W];
        if(_H < ch)
            cam.bg[2] = [_X,0,_W,ch-_H,,_H];
        if(_W < cw && _H < ch)
            cam.bg[3] = [0,0,cw-_W,ch-_H,_W,_H];

        

        
        // console.log(dScl);
    };

    //  SETUP CONTROLS
    db.onkeydown = keyH;
    db.onkeyup = keyH;

    db.onmousedown = mouseH;
    db.onmousemove = mouseH;
    db.onmouseup = mouseH;

    // db.ontouchstart = touchH;
    // db.ontouchmove = touchH;

    db.addEventListener('touchstart',touchH,{passive:false});
    db.addEventListener('touchmove',touchH,{passive:false});
    db.addEventListener('touchend',touchH,{passive:false});

    // db.ontouchend = touchH;

    // setTimeout(() => {
    //     cnv.onclick = () => {
    //         console.log('wtf')
    //     };
    //     console.log(cnv.onclick)
    // },1000)

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
            randBtn.style.visibility = 'hidden';
            playBtn.style.visibility = 'hidden';
            resetTouches();
            // touches = {};
            // touchIDs = [];
            // cnv.onclick = e => {};
            game = new Game(false,socket.id);

        });

        socket.on('score',S => {
            game._points = S;
            for(_iI=0; _iI<S.length; _iI++)
                game.players[S[_iI][2]].points = S[_iI][0];

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
    };

    let audioCtx = null,
    sampleRate = 0,
    sounds = {},
    instruments = {},
    halfStep = 1.059463094,
    //  i = INDEX, p = PERIOD (FREQUENCY/SAMPLE RATE)
    square = (i,p) => { return ((i%p|0)/(p/2))|0 ? -1 : 1 },
    sine =  (i,p) => { return Math.sin(i*6.28/p) },
    saw = (i,p) => { return ((i%p)/p)*2-1 },
    linear = i => i,
    smoothStep = i => { return i * i * Math.pow((3 - 2 * i), 1) },
    acceleration = i => i * i,
    deceleration = i => 1 - Math.pow(1 - i, 2),


    motifs = [
            [1,2],
            [4,5]
        // [ 0,2, 4, 6, 8,10,12,,],
        // [ 0,1, 3, 5, 7, 9,11,,]
    ],
    songs = {
        test: {
            bpm: 140,
            //  NOTES PER BEAT
            npb: 4,
            parts: [
            //  0- INSTRUMENT - MUST EXIST IN intruments ALREADY
            //  1- MOTIF - INDEX OF MOTIF IN motifs TO PLAY
            //  2- ROOT - WHAT MIDI NOTE IS 0
            //  3- NOTE SPACING - IN RELATION TO SONGS npb
            //  4- NUMBER OF REPEATS
            //  5- STARTING BEAT[S] - BEAT NUMBER OR ARRAY OF BEAT NUMBERS
                // ['test',0,40,4,1,[0,8]],
                // ['test',0,47,4],
                // ['test',0,40,4],
                // ['test',0,40,4,,8],

                // ['test',1,40,8,,[8,16]]
                ['test',0,40,4,8],
                ['test',1,40,4,8,17]
            ]
        }
    },

    //  CACHED VARIABLES
    // _song,
    // _motif,
    // _note,
    // _part,
    // _prtI,
    // _noteIndex,
    // _beatTime,
    // _beatIndex,
    // _beatFreq,
    // _activeParts,
    // _I,
    // _L,
    // _songParts,

    _source,
    _gain,
    _song = [0,1],
    _seq = [0,4,0,6],

    
    startAudio = () => {
        sampleRate = audioCtx.sampleRate;
        // sounds['shoot'] = createBuffer();
        createInstrument(['shoot',76,16,[3,660,0.01,0.1,0.1,0.2,0.1,-220,1,40,1,-8,3]]);
        //  WHEN YOU GET HIT AND YOU OR THEY SPLODE
        createInstrument(['splode',40,16,[ 1,120,0.01,0.1,0.1,0.5,0,-60,1,25,1,-15]]);
        //  WHEN THEY GET HIT
        createInstrument(['hit',40,16,[ 1,120,0.01,0.05,0.05,0.4,0,-5,1,25,0.8,-5]]);

        // createInstrument(['thrust',40,10,[0,,0.2,0,0.1,1,0.8,,2,20,1]]);



        // drawWave(sounds['test']);
        createInstrument(['lead',20,25,[3,,0.1,0.1,0.2,0.5,0.05,-1,1,20,0.05,-1]]);
        // createInstrument(['pad',40,25,[2,,0.3,0.2,0.2,1.7,0.7,1,0,80,0.1,-1]]);
        // playSong('test',0);
        // sounds['beat'] = createBuffer([2,120,0,0.1,0.03,0,0,-100]);
        createInstrument(['beat',45,1,[2,,   0.01,0.1,0.03,0,0,-100]]);
        // sounds['beat'] = createBuffer([2,,0.02,0,0.01,1,0.015,,0,10,1]);

        sounds['hat'] = createBuffer([0,,0.02,0,0.01,1,0.015,,0,10,1]);

        // cnv.onclick = undefined;
        playBuffer('beat',0.001,45);
            // playBuffer('hit',0.8,74)
            // playBuffer('test',0.4,30)
            // setTimeout(()=> {playBuffer('test',0.4,31)},400)
    },


    //  o - OPTIONS
    //  0 = NAME TO SAVE INSTRUMENT UNDER
    //  1 = ROOT, MIDI NUMBER OF ROOT
    //  2 = RANGE, HOW MANY MIDI NOTES TO COUNT UP
    //  3 = SFX OPTIONS
    createInstrument = o => {
        instruments[o[0]] = instruments[o[0]] || {};
        let inst = instruments[o[0]];
        for(let i=0,iL=o[2]; i<iL; i++) {
            o[3][1] = freqFromMidi(o[1]+i);
            inst[o[1] + i] = createBuffer(o[3])
        }
    },
    //  o OPTIONS
    //  MAIN GENERATOR 0-3: NOISE, SQUARE, SINE, SAW
    //  MAIN FREQUENCY hz
    //  ATTACK s
    //  DECAY s
    //  SUSTAIN s
    //  SUSTAIN LEVEL 0-1
    //  RELEASE s
    //  PITCH SHIFT hz
    //  TREMOLO GENERATOR 0-2: SQUARE, SINE, SAW
    //  TREMOLO FREQUENCY hz
    //  TREMOLO WEIGHT 0-1
    //  TREMOLO SLIDE hz
    //  EASING TYPE 1-3:  LINEAR, SMOOTHSTEP, ACCELERATION, DECELERATION
    createBuffer = o => {
        //  INPUT VALUES
        let mG = o[0],
            mF = o[1],
            A = o[2]*sampleRate,
            D = o[3]*sampleRate,
            S = o[4]*sampleRate,
            L = o[5],
            R = o[6]*sampleRate,
            pS = o[7] || 0,
            tG = o[8] || -1,
            tF = o[9] || 0,
            tW = o[10] || 0,
            tS = o[11] || 0,
            eT = o[12] || 0,

        //  TIMING SHORTCUTS
            ad = A + D,
            as = ad + S,
        //  PERIOD USED FOR CALCULATION
            P = sampleRate/mF,
        //  EASING VALUE
            eV = 0,

        //  CREATE BUFFER(CHANNELS, LENGTH IN SAMPLES, SAMPLE RATE)
            B = audioCtx.createBuffer(2, as+R, sampleRate),
        //  CACHED VARIABLE FOR ITERATIGN THROUGH BUFFER CHANNELS
            C = null,
        //  CACHED LENGTH OF BUFFER FOR QUICKER ACCESS
            bL = B.length,
        //  CACHED VALUE VARIABLES
            v = 0,
            e = 0,
            t = 0,

        //  ENVELOPE [ADSR] USES LOCAL VARIABLES
            env = i => {
                if(i<=A) e=i/A;
                else if(i<=ad) e=-(i-ad)/D*(1-L)+L;
                if(i>as) e= (-(i-as)/R+1)*L
            };

        //  FOR EACH AUDIO CHANNEL
        for(let i=0;i<2; i++) {
            C = B.getChannelData(i);

            //  FOR EACH SAMPLE OF AUDIO
            for(let j=0,jL=bL; j<jL; j++) {
                //  PROCESS EASING VARIABLE
                // if(eT==0) eV = linear(j/jL);
                if(!eT) eV = linear(j/jL);
                if(eT==1) eV = smoothStep(j/jL);
                if(eT==2) eV = acceleration(j/jL);
                if(eT==3) eV = deceleration(j/jL);

                //  UPDATE PERIOD WITH CHANGING PITCH SHIFT VALUE
                P = sampleRate/(mF + pS*eV);

                //  PROCESS MAIN GENERATOR
                // if(mG==0) v = Math.random()*2-1;
                if(!mG) v = Math.max(0.8,Math.random()*2-1);
                if(mG==1) v = square(j,P);
                if(mG==2) v = sine(j,P);
                if(mG==3) v = saw(j,P);

                //  PROCESS TREMOLO
                //  tG = TREMELO GENERATOR TYPE
                //  IF NO tG VALUE IS SET, THE TREMELO VALUE t IS JUST 1
                t = 1;
                //  OTHERWISE PROCESS GENERATOR FUNCTION
                if(tG==1) t = square(j,sampleRate/(tF+tS*eV))*tW+(1-tW);
                if(tG==2) t = sine(j,sampleRate/(tF+tS*eV))*tW+(1-tW);
                if(tG==3) t = saw(j,sampleRate/(tF+tS*eV))*tW+(1-tW);
                
                //  SCALE TREMOLO VALUE TO BE BETWEEN 0 AND 1
                t = t/2 + 0.5;

                //  PROCESS ADSR ENVELOPE
                env(j);

                //  SET SAMPLE VALUE
                C[j] = v*t*e
            }
        };
        return B;
    },
    freqFromMidi = midi => {
        return roundToTwo(440*Math.pow(halfStep,midi - 69));
    },
    roundToTwo = value => {
        return Math.round(value*100)/100;
    },
    playBuffer = (name,gain,note) => {
        // console.log(audioCtx)
        _source = audioCtx.createBufferSource();
        _gain = audioCtx.createGain();
        _gain.gain.value = gain||0.5;
        if(note) _source.buffer = instruments[name][note];
        else _source.buffer = sounds[name];
        _source.connect(_gain);
        _gain.connect(audioCtx.destination);
        _source.start();
    };
    // playSong = (name) => {
    //     //  CACHE SONG
    //     _song = songs[name];
    //     //  RESET SONG DATA
    //     _beatTime = 0;
    //     _beatIndex = 0;
    //     _noteIndex = -1;
    //     _beatFreq = 60/_song.bpm*1000;
    //     _songParts = {};
    //     _activeParts = [];
    //     //  PUT ALL PARTS OF SONG INTO _songParts
    //     for(_prtI=0; _prtI<_song.parts.length; _prtI++) {
    //         _part = _song.parts[_prtI];
    //         //  IF NO STARTING BEAT IS SPECEFIED, SET IT TO ZERO
    //         if(!_part[5]) _part[5] = 0;
    //         //  IF IT IS AN ARRAY, ADD MULTIPLE PARTS
    //         if(_part[5].length) _part[5].forEach(p5 => addPart(p5,_part));
    //         //  OTHERWISE, JUST ADD THE ONE
    //         else addPart(_part[5],_part);
            
    //     }
    // },
    // // addPart = (i,p) => {
    // //     // console.log(i,p)
    // //     p = p.slice();
    // //     p[5] = i;
    // //     //  IF IT DOESN'T ALREADY EXIST
    // //     //  CREATE ARRAY TO HOLD ANY PARTS THAT START ON THIS BEAT
    // //     if(!_songParts[i]) _songParts[i] = [];
            
    // //     //  PUSH THIS PART TO THAT ARRAY
    // //     _songParts[i].push(p);
    // // },
    // updateSong = (gT) => {
    //     // console.log(gT)

    //     //  CHECK IF WE'VE HIT THE NEXT NOTE YET
    //     if(gT > _beatTime + _beatFreq/_song.npb) {
    //         //  UPDATE TIMING AND INDEX
    //         _beatTime = gT;
    //         _noteIndex++;
    //         //  IF THE NOTE INDEX IS EQUAL TO THE NUMBER OF NOTES PER BEAT npb
    //         if(_noteIndex === _song.npb) {
    //             //  CHECK FOR NEW PARTS STARTING AT THIS BEAT
    //             if(_songParts[_beatIndex]) {
    //                 //  ITERATE THROUGH SONG PARTS STARTING NOW
    //                 _songParts[_beatIndex].forEach((part)=>{
    //                     //  IF IT ISN'T ALREADY A MEMBER
    //                     // if(_activeParts.indexOf(part) === -1)
    //                         //  PUSH IT TO TEH ACTIVE PARTS LIST
    //                         _activeParts.push(part)
    //                 });
    //                 // console.log(_activeParts.length);
    //             };
    //             //  INCREMENT THE BEAT COUNTER AND SET THE NOTE COUNTER TO ZERO
    //             _beatIndex++;
    //             _noteIndex = 0;
    //         };

    //         //  CHECK ACTIVE PARTS
    //         if(_activeParts.length) {
    //             //  ITERATE THROUGH PART LIST
    //             for(_prtI=0; _prtI<_activeParts.length; _prtI++) {
    //                 //  THE PART IN QUESTION
    //                 _part = _activeParts[_prtI];
    //                 //  THE MOTIF IT IS PLAYING
    //                 _motif = motifs[_part[1]];
    //                 //  THE LENGTH OF THE MOTIF SCALED TO THE SONG AND PART SPEEDS
    //                 _L = _motif.length *_song.npb *_part[3]/_song.npb;
    //                 //  THE NOTE NUMBER RELATIVE TO THE START OF HTE PART
    //                 _I = _noteIndex + (_beatIndex -_part[5])*_song.npb;
    //                 //  THE NOTE (IF ANY) THIS PART SHOULD PLAY NOW
    //                 _note = _motif[(_I%_L)/_part[3]];
    //                 //  IF THERE IS A NOTE PLAY IT
    //                 if(_note >= 0) playBuffer(_part[0],0.5,_part[2]+_note);
    //                 //  IF THE LOCAL NOTE INDEX IS PAST THE PART LENGTH TIMES REPEATS
    //                 if(_I >= _L * ((_part[4]||0)+1) -1 ) {
    //                     //  REMOVE FROM ACTIVE PARTS, DECREMENT COUNTER TO STAY IN LINE
    //                     _activeParts.splice(_prtI,1);
    //                     _prtI--;
    //                 }                   
    //             }
    //         }
    //     }
    // };

    

    /**
     * Client module init
     */
    function init() {
        socket = io({ upgrade: false, transports: ["websocket"] });

        bind();
    };

    window.addEventListener("load", init, false);

// })();
