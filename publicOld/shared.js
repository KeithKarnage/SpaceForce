"use strict";

let server,  //  IS THIS INSTANCE THE SERVER
	game, //  CACHED GAME OBJECT


	
	// ctx,  //  CANVAS DRAWING CONTEXT
	_o,  //  CACHED OBJECT VARIABLE
	_oI,  //  CACHED OBJECT INDEX
	_p,  //  CACHED PLAYER VARIABLE
	_pI,  //  CACHED PLAYER INDEX
	PI = Math.PI,  //  PI
	// _id,  //  CACHED ID VARIABLE
	objID = 0,  //  OBJECT ID VARIABLE
	_state,  //  SERVER GAME STATE TO SEND TO CLIENTS
	_s, _sI,
	_beat = 0,
	_beatTime = 0,  //  SONG TIMER
	
	// _states,  //  ALL STATES EVER REVEIVED
	input = [],  //  INPUT FOR ALL ON SERVER, OTHERS ON CLIENT
	_actors = [],  //  AN ARRAY FOR ACTORS FOR STUPID REASONS
	cInput = [0,0,0,0],  //  CLIENT INPUT
	_wasMoving = false,
	lR = 0,  //  LAST ROTATION OF CLIENT PLAYER

	_i, _iI,  //  CACHED INPUT VARIABLES
	_b, _bI,  //  CACHED BULLET VARIABLES
	_tV,_tV2,  //  A TEMPORARY VECTOR USED FOR BULLETS AND MOVEMENT

	// iID = 0,
	_hit,  //  COLLISION VARIABLE
	_hw,  //  HALF WIDTHS

	cList = [],  //  COLLISION LIST
	cTypes = {},  //  THE TYPES OF OBJECTS COLLIDING
	rnd = (val) => { return Math.floor(val*1000)/1000 },
	_n, _d1, _d2,  //  NEAREST, DISTANCE TO
	_dist, _dir,
	_X,_Y,_W,_H,
	bWs = [8,12,6,4,4], //  BULLET WIDTHS

	nearestPlayer = obj => {

		_n = null;
		//  FOR EACH PLAYER
		for(_pI in game.players) {
			//  TEH PLYER
			_p = game.players[_pI];
			//  IT'S CURRENT NEAREST IS IT'S TARGET
			// if(obj.target)
				// _n = obj.target;
			//  MAKE SURE PLAYER EXISTS
			if(_p) {
				//  IF NEAREST HASN'T BEEN SET, SET IT TO BE THE PLAYER
				if(!_n) _n = _p;
				//  DISTANCE TO THE CURRENT NEAREST
				_d1 = obj.pos.dist(_n.pos);
				//  DISTANCE TO THE PLAYER
				_d2 = obj.pos.dist(_p.pos);
				//  IF THE PLAYER IS CLOSER THAN THE NEAREST
				if(_d2 < _d1) {
					//  SET THE NEAREST TO BE THE PLAYER
					_n = _p;
					//  SET DISTANCE 1 TO BE THE NEARER DISTANCE (FOR RETURNING)
					_d1 = _d2;
				}
			}
		}
		//  SET THE ENEMIES TARGET TO THE NEAREST PLAYER'S POSITION
		obj.target = _n;
		//  RETURN DISTANCE TO THE NEAREST
		return _d1;
	},

    _ship,
    randomShip = type => {
        _ship = '';
        switch(type) {
            //  PLAYER
            case 0:
	            //  COCKPIT
                _ship += 1+(Math.random()*3)|0;
                //  BODY
                _ship += (Math.random()*5)|0;
                //  WING
                _ship += (Math.random()*10)|0;
                //  THRUSTERS
                _ship += 1+(Math.random()*3)|0;
                //  PALETTE
                // _ship += Math.random()*4|0;
            break;
            case 1:
                _ship += 0;
                _ship += (Math.random() > 0.5 ? 1 : 5);
                _ship += (Math.random()*10)|0;
                _ship += 4;
            break;
            case 2:
	            _ship += 4;
	            _ship += (Math.random() * 3)|0;
	            _ship += (Math.random() * 3)|0;
	            _ship += (Math.random() * 3)|0;
	            _ship += 0;
	            _ship += (Math.random() * 3)|0;
            break;
        }
    },
    mStats = [10,2.375,9],
    shipStats = ship => {
        return [//  ARMOUR
            (1*ship[1]+ship[2]%5)/2 + 6,
            //  ACCELERATION
            1.25+ (10 - (ship[1]*1+ship[3]*1))/8,
            //  TURN SPEED
            3.5+ 1*ship[3] + (5-ship[2]%5)/2
        ]
    },
    collision = (o1,o2) => {
    	o1.collidedWith[o2.id] = true;
    	o2.collidedWith[o1.id] = true;
    	o1.collided(o2);
    	o2.collided(o1);
		
    },
    _hInt,  //  HIT INTERVAL
    gotHit = p => {

    	// if(game) {
	    	_p = game.player;
			cam.shake();
			emitParticle(_p.pos,0,'splosion');
	        playBuffer('splode',0.05,Math.floor((Math.max(_p.life,0)/1000)*16)+40);
	    // }
    };



//-------------------------------------------------------------------------------
//-------------------------------------------------------------------------------
//-------------------------------------------------------------------------------

class Game {
	constructor(S,id) {
		//  IS THIS INSTANCE RUNNING ON THE SERVER
		server = S;
		game = this;
		this.states = [];
		this._points = [];
		this._pTime = 0,  //  LAST TIME POINTS WAS SENT

		this._eTime = 2000,


		this.pCol = 1,  //  PLAYER COLOUR PALETTES
		//  CANVAS DRAWING CONTEXT, undefined ON SERVER

		//  ID FOR THIS INSTANCE
		this.id = id;
		//  LIST OF PLAYERS IN THE GAME
		this.players = {};
		this.actors = {};
		//  THE CLIENT'S PLAYER
		this.player = null;
		if(!server)
			this.cam = new Obj();

		this.bp = new BroadPhase({w:1000,h:1000,size:24});
		this.objPool = ObjectPool(Obj);
		// for(_i=0; _i<20; _i++) {
		// 	 _o = this.objPool.newObject();
		// 	 _o.release();
		// }

		//  INIT CACHED TEMPORARY VECTOR
		_tV = vec();
		_tV2 = vec();



		_hit = vec();

		this.GL = createGameLoop();
		this.GL.setBegin(this.begin);
		this.GL.setUpdate(this.update);
		this.GL.setEnd(this.end);
		if(!server)
			this.GL.setDraw(this.render);
		setTimeout(this.GL.start,100);

	};
	//--  --  --  --  --  --  --  --  --  --  --  --  --  --  --  --  --
	addPlayer(id,p) {
		p = p || {};

		//  MAKE NEW PLAYER AND ASSIGN IT TO this.players
		_p = this.players[id] = new Obj(id,p.socket,Math.random()*95,Math.random()*95);
		this.actors[id] = _p;
		if(server) {
			p.ship += this.pCol++;
			if(this.pCol > 4) this.pCol = 1;
			_p.sprite = p.ship;
			_o = shipStats(p.ship);
			_p.life = _o[0]*100;
			_p.mLife = _o[0]*100;

			_p.boost = _o[1];
			_p.tSpd = _o[2];
			if(p.ship[0] === '2')
				_p.fSpeed = 150;
			if(p.ship[0] === '3')
				_p.fSpeed = 300;

		};

		//  THE CLIENT'S PLAYER
		if(id === this.id) //{
			this.player = _p;
			//  FOR DEBUG REMOVE LATER
			// this.bp.debugID = id;

			

		//}

		//  IF THIS INSTANCE IS RUNNING ON THE SERVER
		//  SEND THE STATE OUT TO INFORM EVERYONE OF THE NEW PLAYER
		if(server) this.sendState()
	};
	removeObj(id) {

		_p = game.actors[id];
		if(_p && !_p.dead) {
			switch(_p.type) {
				case 'player':
					delete this.players[id];
					if(server) {
						removeUser(users[id]);
						this.sendState()
					};
				break;
				case 'enemy':
				case 'cargo':
					if(!server
					&& _p.pos.dist(game.player.pos) < 500)
						playBuffer('splode',0.01,40);
					// _p.release();
				// break;
				default:
					// if(!server
					// && _p.pos.dist(game.player.pos) < 1000)
					// 	// playBuffer('shoot',0.1,86);
					_p.release();
				break;
				// default:
					// _p.release();
				// break;
			}
		};
		delete game.actors[id];

	};
	//--  --  --  --  --  --  --  --  --  --  --  --  --  --  --  --  --
	sendState() {

		//  RESET THE STATE
		_state = {
			rT: Date.now()
		};
		//  MAKE AN ENTRY RECORDING THE X AND Y FOR EACH ACTOR
		for(_pI in this.actors) {
			_p = this.actors[_pI];
			// if(_p.type === 'player')

			_state[_p.id] = [_p.pos.x,
							_p.pos.y,
							_p.vel.x,
							_p.vel.y,
							_p.dir,
							//  IF IT IS A BULLET, SEND IT'S PARENT ID
							//  OTHERWISE SEND WHETHER IT HAS INPUT THIS CYCLE
							_p.type.substr(1,1) === 'B' ? _p.pID : _p.input,
							//  SEND THE FIRST TWO LETTERS OF THE TYPE
							_p.type.substr(0,2),
							_p.life,
							//  PLAYER MOVEMENT AXIS
							_p.input ? _p.axis.dir() : false,
							_p.sprite
			]
		};
		



		//  SEND THE STATE TO EACH PLAYER
		for(_pI in this.players)
			this.players[_pI].socket.emit('state',_state);
	};
	receiveState(S) {
		game.states.push(S);
	};
	applyState(S) {

		// _states.push(S);
		//  FOR EACH OBJECT INDEX IN THE STATE
		for(_oI in S) {


			//  SKIP THE GAME TIME AND REAL TIME ENTRIES
			// if(_oI === 'gT' || _oI === 'rT') continue;
			if(_oI === 'rT') continue;

			//  THE OBJECTS ENTRY IN THE STATE OBJECT
			_o = S[_oI];
			//  THE OBJECT (IF IT ALREADY EXISTS)
			_p = game.actors[_oI];
			//  IF IT DOES EXIST AND ISN'T THE PROPER TYPE, REMOVE IT
			if(_p && _p.type.substr(0,2) !== _o[6]) {
				// console.log('removing oddject',_p.type.substr(0,2),_p.id, _o[6],_oI);
				game.removeObj(_oI);
				_p = null
			};
			// console.log(_oI)
			//  IF THE OBJECT INDEX IS NOT INCLUDED IN this.players, MAKE A NEW PLAYER
			//  addPlayer() SETS _p TO THE MOST RECENTLY CREATED PLAYER
			switch(_o[6]) {
				case 'pl':
					//  IF IT DOESN'T EXIST, MAKE A NEW PLAYER
					if(!_p) {
						addShip(_o[9]);
						this.addPlayer(_oI)
					};


					//  IF IT IS THE CLIENT'S PLAYER AND THEY TOOK DAMAGE
					if(_o[7] < _p.life) {
						_p.life = _o[7];
						
						_p.hurt = Date.now();
						emitParticle(_p.pos,0,'splosion');
						if(_oI === game.id) {
							gotHit();

							//  END GAME EXPLOSIONS
							if(_p.life <= 0) {
								_p.dead = true;
								// touchIDs = [null,null];
								// mouse.clr();


								localStorage.highScore = Math.max(localStorage.highScore || 0, _p.points);


								// console.log(localStorage);


								_hInt = setInterval(gotHit,200);
								// console.log(_hInt)

								setTimeout(()=> {
									clearInterval(_hInt);
									// cam.pos.clr();
								},2600);
							}
						} else playBuffer('hit',0.1,Math.floor((1-(_p.life/1000))*16)+40);
					};
					_p.life = _o[7];
					if(_p.mLife === 1) _p.mLife = _p.life;


				break;
				case 'pB':
				case 'eB':
					//  IF IT DOESN'T EXIST
					if(!_p) {
						//  MAKE A NEW BULLET
						_p = game.fireBullet(0,_o,_oI);
						//  IF IT IS THE CLIENT PLAYER'S BULLET, SHAKE CAM
						if(_o[5] === game.id)
							cam.shake(game.player.dir +0.001);
						playBuffer('shoot',0.05,(_o[6]==='eB'?76:80));
					};
				break;
				case 'en':
				case 'ca':
					//  IF THE ENEMY DOESN'T EXIST
					if(!_p) {
						addShip(_o[9]);
						game.addEnemy(_o,_oI);
					};
					if(_o[7] < _p.life) {
						_p.life = _o[7];
						_p.hurt = Date.now();
						emitParticle(_p.pos,0,'splosion');
						playBuffer('hit',0.05,Math.floor((1-(_p.life/1000))*16)+40);

					};

				break;
			};
			if(_p){
				_p.pos.x = _o[0];
				_p.pos.y = _o[1];
				_p.vel.x = _o[2];
				_p.vel.y = _o[3];
				_p.dir = _o[4];
				//  FOR BULLETS, INPUT ACTS AS THE PARENT ID

				_p.input = _o[5];
				//  _o[6] IS THE OBJECT TYPE USED ABOVE
				//  _o[7] IS LIFE, DEALT WITH ABOVE AS WELL
				_p.axis.vFrD(_o[8]);
				_p.sprite = _o[9]
				// console.log(_o[9])
			}
		};
		//  REMOVE ANY OBJECTS NOT INCLUDED IN THE STATE
		for(_pI in this.actors) {
			_p = this.actors[_pI];
			if(_p && !S[_pI])
				game.removeObj(_pI);
		}
	};
	//--  --  --  --  --  --  --  --  --  --  --  --  --  --  --  --  --
    sendInput () {
    	_p = game.player;
    	if(!_p) return;
    	//  1 - FIRING
    	//  2 - X AXIS
    	//  3 - Y AXIS
    	//  4 - ROTATION
    	//  5


    	if(cInput[2] || cInput[3])
    		_wasMoving = true;
        cInput = [socket.id,0,0,0,null];

        //  IF MOUSE IS PRESSED, SPACE BAR IS PRESSED, OR A SECOND TOUCH IS HAPPENING
		if(mouse.pressed || touchIDs[1])
			cInput[1] = 1;
		if(keys[32]) cInput[1] = 2;
		
		//  IF THE MOUSE HAS BEEN MOVED
		// console.log(cInput[1])
       

		//  RECORD AXIS (ARROWS/WASD/ZQSD OR FIRST TOUCH)
		
		//  USE TEMPORARY VECTOR FOR INPUT
		_tV.clr();

		//  IF THERE IS A FIRST TOUCH
		_tID = touchIDs[0];
		if(_tID !== null) {
			//  THE TOUCH
			_t = touches[_tID];
			//  THE TOUCHES POSITION
			_tP = touchPos(_t);
			//  COPY THE TOUCH POSITION, THEN SUBTRACT THE PLAYER POSITION
			//  TO GET A VECTOR POINTING FROM THE PLAYER TO THE TOUCH
			_tV.copy(_tP).sub(touchPos(touchStart[0]));
			// console.log(_tV,_t)
		//  KEYBOARD
		}else {

		
	        //  LEFT
	        if(keys[65] || keys[81] || keys[37])
	            _tV.x -= 1;
	        //  UP
	        if(keys[87] || keys[90] || keys[38])
	            _tV.y -= 1;
	        //  RIGHT
	        if(keys[68] || keys[39])
	            _tV.x += 1;
	        //  DOWN
	        if(keys[83] || keys[40])
	            _tV.y += 1;
	    };

		_tV.unit();
		cInput[2] = _tV.x;
		cInput[3] = _tV.y;


        //  RECORD DIRECTION PLAYER IS FACING (TOWARD MOUSE OR SECOND TOUCH)
        	// cInput[4] = game.player.tDir.dir();
        
        //  IF THERE IS A TOUCH ON THE RIGHT SIDE
        _tID = touchIDs[1];
        if(_tID !== null) {

        	_t = touches[_tID];

        	_tP = touchPos(_t);

			//  SET FIFTH INPUT TO TOUCH POSITION MINUS TOUCH START, DIRECTION
	        cInput[4] = _tP.sub(touchPos(touchStart[1])).dir();
	        // console.log(touchStart[1]);
	        // console.log(cInput[4] )

	    //  NO TOUCHES ON RIGHT SIDE
        } else {
        	//  IF THEY ARE NOT FIRING SET THE FACING DIRECTION TO THE DIRECTION OF MOVEMENT
        	if(_tV.dir() + PI >= 0)
	        	cInput[4] = _tV.dir()
        };

		if(!_tID) {
		 	switch(cInput[1]) {
		 		case 1:
		        	//  MAKE THE FIFTH INPUT TO A VECTOR POINTING FROM THE PLAYER TO THE MOUSES POSITION, DIRECTION
		        	cInput[4] = _tV.copy(mouse).sub(game.player.pos).dir();
	        	break;
	        	case 2:
		        	cInput[4] = _tV.dir();
	        	break;
	        }
        };

		//  IF THERE HAS BEEN NO MOUSE OR RIGHT SIDE TOUCHES, SET THIS TO WHAT IT WAS LAST FRAME
        if(cInput[4] === null) cInput[4] = lR;

       
        if(cInput[1] || cInput[2] || cInput[3] || cInput[4] !== lR || _wasMoving) {
        	_wasMoving = false;
	        //  INPUT ID
	        // cInput[1] = iID++;
        // console.log(cInput[4])

            socket.emit('input',cInput);
            //  LAST ROTATION (SO WE KNOW IF THE NEXT ONE IS DIFFERENT)
            lR = cInput[4];
            // console.log(cInput)
        }
    };
	receiveInput(I) {

		//  FIRST INDEX IS PLAYER ID
		//  IF IT DOESN'T EXIST IN input
		if(!input[I[0]])
			//  MAKE AN ARRAY TO HOLD INPUT FROM THIS PLAYER
			input[I[0]] = [];

		//  PUSH THE INPUT TO THAT ARRAY
		input[I[0]].push(I);
	};
	//--  --  --  --  --  --  --  --  --  --  --  --  --  --  --  --  --
	checkCollision(o1,o2) {
		if(!o1 || !o2) return false;
		//  CIRCULAR COLLISION
		_hit.copy(o1.pos).sub(o2.pos);
		_hw = o1.w/2 + o2.w/2;
		if(_hit.mag() < _hw) {
			//  MAKE -hw NOW EQUAL TO THE OBJECT OVERLAP
			_hw -= _hit.m;
			//  SCALE HIT DIRECTION TO THE AMOUNT OF OVERLAP AND RETURN
			return _hit.unit().scl(_hw);
		} else return false
	};
	fireBullet(p,b,id) {
		if(server) {
			if(!p.firing) {
				p.firing = true;
				p.fTime = Date.now();
				
				//  SET TEMP VECTOR TO THE PLAYER (THAT IS SHOOTING) DIRECTION FACING SCALED FOR SPEED
				_tV.vFrD(p.dir).scl((p.type === 'player' ? 8 : 5));
				if(p.sprite[0]==4)
							_tV.scl(-1);
				_o = {
					type: p.type === 'player' ? 'pBullet' : 'eBullet',
					x: p.pos.x+_tV.x,
					y: p.pos.y+_tV.y,
					dir: p.dir,
					vx: p.vel.x + _tV.x,
					vy: p.vel.y + _tV.y,
					pID: p.id,
					w: bWs[p.sprite[0]]
					// w: p.type === 'player' ? 12 : 8
				};

				//  RESET
				// _tV2.clr();
				

				// COCKPIT TYPE DECIDES FIRING PATTERN
				// console.log(p.sprite[0])
				switch(p.sprite[0]) {
					//  DUAL BLASTERS
					case '2':
						//  COUNT 0,1,0,1
						// _o.w = 6
						p.fI = (p.fI + 1) % 2;
						_tV2.vFrD(p.dir + PI/2 * (p.fI?1:-1)).scl(4);
						_o.x += _tV2.x;
						_o.y += _tV2.y;
						_b = game.objPool.newObject(_o);
						game.actors[_b.id] = _b;
					break;
					//  SPREAD SHOT BUBBLE DOME
					case '3':
					case '4':

						// _o.w = 4;
						// console.log('wtf')
						_b = game.objPool.newObject(_o);
						game.actors[_b.id] = _b;
						_tV2.vFrD(p.dir + PI/2).scl(10);
						_o.x += _tV2.x;
						_o.y += _tV2.y;
						_o.vx += _tV2.x/6;
						_o.vy += _tV2.y/6;
						_b = game.objPool.newObject(_o);
						game.actors[_b.id] = _b;
						// _tV2.vFrD(p.dir - PI/2).scl(20);
						_o.x -= _tV2.x*2;
						_o.y -= _tV2.y*2;
						_o.vx -= _tV2.x/3;
						_o.vy -= _tV2.y/3;
						_b = game.objPool.newObject(_o);
						game.actors[_b.id] = _b;
						
					break;
					default:
						_o.w = 12;
						_b = game.objPool.newObject(_o);
						game.actors[_b.id] = _b;
					break;
					
				};

				
				//  RESEET p.fI FOR FIRING
				// p.fI = 1;
				//  MAKE NEW BULLET
				// _b = game.objPool.newObject(_o);
				
				// game.actors[_b.id] = _b;
			}
		} else {
			//  CLIENT SIDE JUST MAKE NEW BULLET WITH DATA FROM STATE
			_b = game.objPool.newObject({
				type: b[6] === 'pB' ? 'pBullet' : 'eBullet',
				x: b[0],
				y: b[1],
				id: id,
				pID: b[5],
				w: bWs[game.actors[b[5]].sprite[0]]
			});
			game.actors[_b.id] = _b;

		};
		//  ADD BULLET TO ACTOR LIST
		return _b;		
	};
	//  FIND LOCATION TO SPAWN ENEMY THAT IS x PIXeLS AWAY FROM P,
	//  BUT NOT ON ANY OTHER PLAYER'S SCREENS, PUT LOC IN o = [x,y]
	findSpawnLocation(P,o) {
		//  RANDOM DIRECTION 
		_tV.vFrD(Math.random()*PI*2).scl(360).add(P.pos);
		for(_pI in game.players) {
			_p = game.players[_pI];
			if(_tV.dist(_p.pos)<250)
				return false
		} return [_tV.x,_tV.y,_tV.dir()];
	};
	addEnemy(o,id,P) {
		if(P) {
			o = game.findSpawnLocation(P);
			// randomShip(2);
			randomShip(Math.random()<0.8?1:2);
		};
		if(o) {
			// for(_iI=0; _iI<3; _iI++) {
				// _tV.vFrD(o[2]).scl(80);
				// console.log(o[9]);
				if(!server) _ship = o[9];
				_p = game.objPool.newObject({
					type: (_ship[0]=='4'?'cargo':'enemy'),
					x: o[0],
					y: o[1],
					id: id,
					w: (_ship[0]=='4'?28:16),
					sprite: _ship
				});
				// console.log('enemy added',_p.id);
				if(P) _p.vel.copy(P.vel);
				if(_p.type=='cargo') _p.vel.scl(0.5);
				game.actors[_p.id] = _p;
				// console.log(_p.type);

			// }
		}
	};
	
	//--  --  --  --  --  --  --  --  --  --  --  --  --  --  --  --  --
	begin(ts,fD,gT) {
		if(!game) return;

		if(!server)
			game.sendInput();
		else {
			game.sendState();

			if(gT - game._pTime > 500) {
				game._pTime = gT;
				game._points = [];
				for(_pI in game.players) {
					_p = game.players[_pI];
					game._points.push([_p.points,_p.sprite[4],_p.id]);
					game._points.sort((a,b) => b[0]-a[0]);
					// game._points.push([_p.sprite[4]]);

					// game._points[_p.sprite[4]] = _p.points;
				};
				for(_pI in game.players)
					game.players[_pI].socket.emit('score',game._points);

			}
		}
		
	};
	update(ts,gT) {
		if(!game) return;
		
		//  ON THE SERVER
		if(server) {
			game._eTime -= ts;
			if(game._eTime <= 0) {
				game._eTime = 3000;
				//  REUSING ACTORS
				_actors = Object.keys(game.players);
				game.addEnemy(null,null,game.players[_actors[Math.random()*_actors.length|0]]);
			};


			//  FOR EACH ACTOR
			for(_pI in game.actors) {
				_p = game.actors[_pI];
				//  IF THEY HAVE INPUT TO BE PROCESSED
				if(input[_p.id]) {
					if(input[_p.id].length > 0) {

						//  WHILE THERE IS STILL INPUT
						while(input[_p.id].length > 0) {
							//  REMOVE THE FIRST ENTRY
							_i = input[_p.id].shift();

							//  HAVE THE PLAYER PROCESS THE INPUT
							_p.processInput(_i,ts);

							//  IF FIRING, CREATE BULLET
							// if(_i[1] && !_p.firing)
								// game.fireBullet(_p);
							//  IF THERE IS DATA ON THE X OR Y AXES
							// if(_i[2] || _i[3])
							// 	_p.input = true;
						}
					}
				};
				//  UPDATE ACTOR
				_p.update(ts);
			};
			//  REGISTER NEW POSITIONS IN BROADPHASE GRID
			game.bp.clearGrid();
			_actors = [];
			Object.keys(game.actors).forEach(key => {
				_actors.push(game.actors[key]);
			});
			game.bp.populateGrid(_actors);
				// console.log("COLLISION")
			let N = Date.now();
			for(_pI in game.actors) {
				_p = game.actors[_pI];					
				cList = game.bp.findMatches(_p);
					// console.log(cList)

				// cList.forEach( obj => {
				for(_oI=0; _oI<cList.length; _oI++) {
					_o = cList[_oI];

					if(!_p
					|| !_o
					|| _p.hurt
					|| _o.hurt
					|| _p.pID === _o.id
					|| _o.pID === _p.id
					|| _o.collidedWith[_p.id]
					|| _p.collidedWith[_o.id])
						continue;

					if(game.checkCollision(_p,_o))
						collision(_p,_o)
				}
				// });
			}
		//  ON THE CLIENT
		} else {
			if(Date.now() > _beatTime) {
				if(game.player) {
					//  REUSING _hw
					_hw = (1-(game.player.life/game.player.mLife))
					_beatTime = Date.now() + 350 - 200*_hw;
					if(_beat%2 === 0)
						playBuffer('lead',0.05,35+_song[((_beat/2)|0)%2]+_seq[((_beat/16)|0)%4]);
					// console.log((_beat/2)|0
					// if(_beat%8 == 0) playBuffer('pad',0.5,42+_song[((_beat/8)|0)%2]+_seq[((_beat/32)|0)%2]);
					if(_hw > 0.67 && _beat%4 == 0) playBuffer('beat',1);
					if(_hw > 0.5 && _beat%4 != 3) playBuffer('hat',_beat%4==0?1:0.7);
					_beat++;
				}
				
			};
			// updateSong(gT);
	        // if(!game.player) return;
	        particlePool.active.forEach(p => updateParticle(ts,p));

			// if(game.player && cam)
				// console.log(cam.pos.x + cam.w/scale,game.player.pos.x,cam.pos.x + cam.w/scale-game.player.pos.x)

			//  UPDATE EACH PLAYER
			for(_pI in game.actors) {
				_p = game.actors[_pI];
				_p.update(ts);

				//  UPDATE OFFSCREEN ARROW POSITIONS
				// if(cam.offScreen(_p)) {
				if(_p.id !== game.id && (_p.type === 'player' || _p.type === 'enemy' || _p.type === 'cargo')) {
					_tV.copy(_p.pos).sub(game.player.pos);
					//  SLOPE OF LINE TO PLAYER
					//  _H IS BEING REUSED AND DOESN'T REPRESENT HEIGHT HERE
					_H = _tV.x/_tV.y;
					_W = _tV.y/_tV.x;
					//  ACTOR TO THE RIGHT OF PLAYER
					if(_p.pos.x > game.player.pos.x) {
						//  DISTANCE TO RIGHT SIDE OF SCREEN
						_X = (cam.pos.x+cam.w/scale)-game.player.pos.x;
						
						//  ACTOR BELOW PLAYER
						if(_p.pos.y > game.player.pos.y) {
							//  DISTANCE TO BOTTOM OF SCREEN
							_Y = (cam.pos.y+cam.h/scale)-game.player.pos.y;
							
							//  _X/_H IS THE Y INTERCEPT
							//  IF IT IS LESS THAN THE HEIGHT OF THE SCREEN BELOW THE CHARACTER IT INTERSECTS WITH THE RIGHT SIDE
							if(_X/_H < _Y )
								//  THIS IS THE Y INTERCEPT WITH THE RIGHT EDGE OF THE SCREEN
								_p.arrow.copy({x:_X,y:_X/_H});
								
							//  IF IT IS TALLER THAN THE HEIGHT OF THE SCREEN, IT WILL INTERCECT WITH THE BOTTOM
							else _p.arrow.copy({x:_Y/_W,y:_Y});

						//  ACTOR ABOVE PLAYER
						} else {
							//  DISTANCE TO TOP OF SCREEN
							_Y = game.player.pos.y - cam.pos.y;

							//  _X/_H IS THE Y INTERCEPT
							//  IF IT IS LESS THAN THE HEIGHT OF THE SCREEN ABOVE THE CHARACTER IT INTERSECTS WITH THE RIGHT SIDE
							if(Math.abs(_X/_H) < _Y )
								//  THIS IS THE Y INTERCEPT WITH THE RIGHT EDGE OF THE SCREEN
								_p.arrow.copy({x:_X,y:_X/_H});
							//  IF IT IS TALLER THAN THE HEIGHT OF THE SCREEN, IT WILL INTERCECT WITH THE TOP
							else _p.arrow.copy({x:-_Y/_W,y:-_Y})
						}
					//  ACTOR TO THE LEFT OF PLAYER
					} else {
						//  DISTANCE TO LEFT SIDE OF SCREEN
						_X = game.player.pos.x - cam.pos.x;

						//  ACTOR BELOW PLAYER
						if(_p.pos.y > game.player.pos.y) {
							//  DISTANCE TO BOTTOM OF SCREEN
							_Y = (cam.pos.y+cam.h/scale)-game.player.pos.y;
							
							//  _X/_H IS THE Y INTERCEPT
							//  IF IT IS LESS THAN THE HEIGHT OF THE SCREEN BELOW THE CHARACTER IT INTERSECTS WITH THE RIGHT SIDE
							if(Math.abs(_X/_H) < _Y )
								//  THIS IS THE Y INTERCEPT WITH THE RIGHT EDGE OF THE SCREEN
								_p.arrow.copy({x:-_X,y:-_X/_H});
								
								// console.log;
							//  IF IT IS TALLER THAN THE HEIGHT OF THE SCREEN, IT WILL INTERCECT WITH THE BOTTOM
							else _p.arrow.copy({x:_Y/_W,y:_Y});
						//  ACTOR ABOVE PLAYER
						} else {
							//  DISTANCE TO TOP OF SCREEN
							_Y = game.player.pos.y - cam.pos.y;
							
							//  _X/_H IS THE Y INTERCEPT
							//  IF IT IS LESS THAN THE HEIGHT OF THE SCREEN ABOVE THE CHARACTER IT INTERSECTS WITH THE RIGHT SIDE
							if(Math.abs(_X/_H) < _Y )
								//  THIS IS THE Y INTERCEPT WITH THE RIGHT EDGE OF THE SCREEN
								_p.arrow.copy({x:-_X,y:-_X/_H});
							//  IF IT IS TALLER THAN THE HEIGHT OF THE SCREEN, IT WILL INTERCECT WITH THE TOP
							else _p.arrow.copy({x:-_Y/_W,y:-_Y});
						}
					}
					_p.arrow.scl(0.9).add(game.player.pos);
					_p.arrow.s = (1.2-_p.pos.dist(game.player.pos)/1500)*1.7;
					if(_p.type == 'player' && _p.arrow.s < 0.4)
						_p.arrow.s = 0.4;
					//  THE DIRECTION IT IS POINTING (FOR AIMING AN ARROW)
					_p.arrow.d = _tV.dir();
					// _p.arrow.scl(0.8);
				}
				// } else _p.arrow.d = null;
			};
			//  IF THERE ARE ANY STATES FROM THE SERVER
			for(_sI=0; _sI < game.states.length; _sI++) {
				_s = game.states[_sI];
				//  IF IT IS TIME
				if(Date.now() > _s.rT + 100) {
					game.applyState(_s);
					game.states.shift();
					_sI--;
				} else continue;
			};
			if(game.player)
				cam.follow(ts);

		}
		
	};
	render() {
		if(!game) return;
		ctx.fillStyle = colours[16];
		ctx.fillRect(0,0,cam.w,cam.h);
		
		ctx.save();
		ctx.scale(scale,scale);
		ctx.translate(-cam.pos.x + cam.shk.x,-cam.pos.y + cam.shk.y);
		// stars.forEach(star => {
		// 	displayObj(star);
		// })
		cam.bg.forEach((bg,i) => {
			ctx.drawImage(images.stars,
				bg[0],bg[1],bg[2],bg[3],
				i===0||i===2?cam.pos.x:cam.pos.x+bg[4],
				i===0||i===1?cam.pos.y:cam.pos.y+bg[5],
				bg[2],bg[3]);
		});
		// ctx.drawImage(images.stars,-512,0);
		// ctx.drawImage(images.stars,-512,-512);
		// ctx.drawImage(images.stars,0,-512);

		

		//  DRAW GRID FOR DEBUGGING
		// game.bp.drawBroadPhaseGrid(ctx);
		// displayObj(game.stage);

		// game.actors.forEach( a => displayObj(a) );
		for(_pI in game.actors) {
			_p = game.actors[_pI];
			if(!cam.offScreen(_p))
				displayObj(_p);
			else {

				//  DRAW ARROWS THAT WE SPENT SO MANY BYTES CALCULATING THE LOCATION OF
				if((_p.type === 'player' || _p.type === 'enemy' || _p.type === 'cargo')&& _p.id !== game.id) {
					if(_p.arrow.d) {
						ctx.save();
						ctx.translate(_p.arrow.x,_p.arrow.y);
						ctx.rotate(_p.arrow.d-PI/2);
						ctx.scale(_p.arrow.s,_p.arrow.s);
						ctx.drawImage(images.sprites,_p.sprite[4]*8||0,80,8,8,-8,-8,16,16);
						ctx.restore();
					}
				}
			};
		};

		particlePool.active.forEach(p => displayObj(p));

		
		ctx.restore();

		_p = game.player;
		if(_p) {
			// console.log(_p.sprite)
			// ctx.drawImage(images.sprites,0,0,512,512);
			if(!_p.dead) {
				//  DRAW POINTS IN CORNER IN ORDER RECIEVED FROM SERVER
				for(_oI=0; _oI<game._points.length; _oI++) {
					_o = game._points[_oI];
					ctx.fillStyle = colours[palettes[_o[1]][1]];
					// console.log(palettes[_o[1]][2]);
					ctx.font = Math.floor(scale*10)+'px '+'futura';
					ctx.fillText(_o[0],10,30 + _oI*Math.floor(scale*10));
				};
				ctx.fillStyle = colours[0];
				ctx.fillText('❤️'+Math.max(0,_p.life),128,30);
			} else {
				ctx.fillStyle = 'white';
				ctx.fillText('YourScore: '+_p.points,
					cnv.width/scale/4,
					cnv.height/scale/2);
				ctx.fillText('High Score: '+(localStorage.highScore||0),
					cnv.width/scale/4,
					cnv.height/scale/4);
			};
			for(_oI=0; _oI<2; _oI++) {
				_o = touchStart[_oI];
				if(_o) {
					ctx.strokeStyle = 'red';
					ctx.beginPath();
					ctx.moveTo(_o.clientX,_o.clientY);
					_o = touches[touchIDs[_oI]];
					ctx.lineTo(_o.clientX,_o.clientY);
					ctx.stroke();
				}

			}
			// ctx.fillText(message,100,100);

		}

	};
	end() {
		if(!game) return;
		for(_pI in game.actors) {
			_p = game.actors[_pI];
			// _p.debug = false;
			_p.collidedWith = {};
		};
		if(!server) mouse.moved = false;
	};
};




//-------------------------------------------------------------------------------
//-------------------------------------------------------------------------------
//-------------------------------------------------------------------------------
let vec = (x,y) => new Vec(x,y);
class Vec {
	constructor(x=0,y=0) {
		this.x = x;
		this.y = y;
		this.m = 0;
		return this;
	};
	copy(v) {
		this.x = v.x;
		this.y = v.y;
		return this;
	};
	vFrD(d) {
		this.x = Math.cos(d);
		this.y = Math.sin(d);
		return this;
	};
	clr() {
		this.x = 0;
		this.y = 0;
		return this;
	};
	add(v) {
		this.x += v.x;
		this.y += v.y;
		return this;
	};
	sub(v) {
		this.x -= v.x;
		this.y -= v.y;
		return this;
	};
	scl(v) {
		this.x *= v;
		this.y *= v;
		return this;
	};
	dir() {
		return Math.atan2(this.y,this.x);
	};
	dist(v) {
		return Math.sqrt((v.x-this.x)*(v.x-this.x) + (v.y-this.y)*(v.y-this.y));
	};
	mag() {
		this.m = Math.sqrt(this.x*this.x +this.y*this.y);
		return this.m;
	};
	unit() {
		this.mag();
		this.x /= this.m;
		this.y /= this.m;
		this.mag();

		return this;
	};
};


//-------------------------------------------------------------------------------
//-------------------------------------------------------------------------------
//-------------------------------------------------------------------------------


class Obj {
	constructor(id,S,x,y,w,h,type) {
		//  user REFERENCE FOR SERVER, undefined ON CLIENT INSTANCES
		this.socket = S;
		this.id = id || objID++;

		this.type = type || 'player';

		this.points = 0;

		this.life = 1;
		this.mLife = 1;
		this.hurt = false;
		this.heal = 750;
		// this.tookDamage = false;

		//  FILL STYLE
		this.fS = 'hsl('+Math.floor(Math.random()*256)+',100%,50%)';

		this.pos = vec(x,y);
		this.vel = vec();
		this.axis = vec();
		this.dir = 0;

		this.acc = 0.3;
		this.boost = 1;
		//  tDir GETS REUSED AS A SCALAR VALUE ON THE SERVER
		//  TARGET DIRECTION
		this.tDir = vec();
		this._d;  //  CACHED DIRECTION VARIABLE

		//  ENEMIES TARGET
		this.target = vec();

		this._in = [];

		//  ROTATION
		// this.r = 0;
		this.tSpd = 1;
		//  WIDTH HEIGHT
		this.w = w || 16;
		this.h = h || 16;

		//  FIRING SPEED / TIMER
		this.firing = 0;
		this.fSpeed = 200;
		this.fTime = 0;
		this.fI = 0;   //  FIRING INDEX

		// this.tTime = 0;  //  TIMER FOR THRUSTER SOUNDS

		// this.eTimer = 2000;

		//  INPUT THIS CYCLE
		//  GETS REUSED FOR PARENT ID
		this.input = false;  

		this.collidedWith = {};

		this.arrow = vec();

		this.debug = false;



	};
	//  ONLY CALLED ON POOLED OBJECTS
	init(o) {
		this.type = o.type;
		this.arrow.clr();
		this.name = o.name;
		this.lastHit = null;
		// console.log(o.type,this.type)

		this.life = o.life || 1000;
		this.hurt = false;
		this.dead = false;

		this.mLife = o.life;

		this.dir = o.dir || 0;

		this.pos.copy(o);
		this.vel.x = o.vx || 0;
		this.vel.y = o.vy || 0;
		this.id = o.id || this.id;
		// console.log(this.type,o.id,this.id);
		this.pID = o.pID;
		//  MAKE ENEMIES FIRE SLOWER (PLAYERS ARE NOT init-ED)
		this.fSpeed = 600;
		// switch(this.type) {
			// case 'enemy':
		this.acc = this.type=='enemy'?0.25:0.1;
			// break;
			// case 'eBullet':
			// break;
		// }
		// console.log(o.w)
		this.w = o.w;
		this.h = o.h || o.w;
		this.sprite = o.sprite;
	};
	update(ts) {

		//  PROCESS MOVEMENT
		this.pos.add(this.vel);
		// console.log(this.vel)
		_p = this;
		if((_p.type === 'player' || _p.type === 'enemy' || _p.type === 'cargo') && this.vel.mag() > 2.5)
			this.vel.unit().scl(2.5);


		//   ADD FRICTION
		// if(!this.input && this.type === 'player' || this.type === 'enemy') {
		// 	console.log('applying friction')
		// 	this.vel.x *= 0.98;
		// 	this.vel.y *= 0.98;
		// }


		
		if(server) {

			

			//  COUNT DOWN BULLET LIFE AND REMOVE
			switch(this.type) {
				case 'pBullet':
				case 'eBullet':
					this.life -= Math.floor(ts);
					if(this.life <= 0)
						game.removeObj(this.id);
				break;
				case 'player':
					// this.eTimer -= ts;
					// if(this.eTimer < 0) {
					// 	this.eTimer = 5000;
					// 	game.addEnemy(null,null,this);
					// }
					this.heal -= ts;
					if(this.heal < 0) {
						this.heal = 750;
						// console.log('heal')
						this.life = Math.min(this.mLife,this.life + 10);
					};
					if(this.life <= 0)
						game.removeObj(this.id);
				break;
				case 'enemy':
				case 'cargo':
				// console.log(this)
					if(nearestPlayer(this) > 1500)
						game.removeObj(this.id);
					if(this.life <= 0) {

						game.removeObj(this.id);
						this.dead = true;
					} else this.ai(ts);
				break;
			}

			
		//  NOT ON SERVER
		} else {
			switch(this.type) {
				case 'player':
				case 'enemy':
				case 'cargo':
			// if(this.type === 'player' || this.type === 'enemy') {

					if(this.input && !this.dead) {
						//  THRUSTER SOUND
						// if(this.id === game.id) {
						// 	if(this.tTime <= 0) {
						// 		playBuffer('thrust',0.1,40);
						// 		this.tTime = 300;
						// 	} else this.tTime -= ts;
						// }
						//  THRUSTER PARTICLES
						emitParticle(_tV.vFrD(this.dir).unit().scl(this.type==='cargo'?-28:-8).add(this.pos),this.axis.dir(),'thruster',this.vel.mag()* -1);
					};
				break;
				case 'eBullet':
				case 'pBullet':
					emitParticle(this.pos,0,'bullet');
				break;
			}
		};
		//  HURT TIMER
		if(this.hurt && Date.now()-this.hurt > 100)
			this.hurt = false;

		//  RESET FIRING VARIABLE
		if(this.firing && Date.now() > this.fTime + this.fSpeed + Math.random()*50)
			this.firing = false;
	};
	processInput(I,ts) {

		this.input = false;

		//  APPLY INPUT
		//  SAVE THE AXIS DIRECTION TO SEND IT TO ALL CLIENTS SO THEY KNOW WHAT WAY TO DRAW THRUST
		this.axis.x = I[2];
		this.axis.y = I[3];
		//  IF THE DIRECTION OF ACCELERATION IS WITHIN ONE RADIAN OF THE DIRECTION OF FACING
		_dir = Math.abs((this.axis.dir()+PI)-(I[4]+PI)); 
		if(_dir < 0.5 || _dir > 2*PI - 0.5)
			this.boost = 2;

		this.vel.x += I[2] * this.acc * this.boost * ts/1000;
		this.vel.y += I[3] * this.acc * this.boost * ts/1000;
		this.tDir = I[4] || 0;

		this.boost = 1;

		if(I[1])
			game.fireBullet(this);

		if(I[2] || I[3])
			this.input = true;

		//  PROCESS TURNING
		//  THE DIRECTION WE ARE FACING AND THE DIRECTION THE INPUT WANTS TO FACE
		//  BOTH FROM -PI TO PI, ADD PI TO MAKE FROM 0 TO 2PI
		// if(this.type === 'enemy')

		this._d = this.turnDir(this.dir+PI, this.tDir+PI);
		if(this._d
		&& (this.input || I[1] !==2)) {


			this._d = this.turn(this._d,this.tSpd *ts/1000);

			this.dir = (this.dir + this._d) % (2 * PI);
		}
	};
	ai(ts) {
		if(this.target) {
			this._in = [];
			//  DISTANCE FROM ENEMY TO TARGET
			_dist = this.pos.dist(this.target.pos);
			//  UNIT VECTOR POINTING FROM TARGET TO ENEMY
			_tV.copy(this.pos).sub(this.target.pos).unit();

			switch(this.type) {
				case 'enemy':
					//  BELOW 500 PIXELS, ACCELERATE DIRECTLY AWAY FROM TARGET
					if(_dist > 75
					&& _dist < 125)
					//  CIRCLE
						_tV.vFrD(_tV.dir()+PI*1.5);
					//  ELSE IF BELOW 2000, ACCELERATE DIRECTLY TOWARDS
					else if(_dist < 2000)
						_tV.scl(-1);

					if(_dist < 280 && _dist > 125)
						this._in[1] = 1;
				break;
				case 'cargo':
					if(_dist < 260)
						this._in[1] = 1;
				break;
			};
			//  FAKE INPUT ARRAY
			this._in[2] = _tV.x;
			this._in[3] = _tV.y;
			this._in[4] = _tV.dir();
			this.processInput(this._in,ts);
		} //else this.vel.scl(0.8);
	};
	collided(obj) {

		// this.collidedWith[obj.id] = true;
		_o = game.players[obj.pID || obj.id];

		switch(this.type) {
			case 'player':
				// switch(obj.type) {
					// case 'eBullet':
					// case 'pBullet':
						// this.tookDamage = true;
						this.life -= 50;

					// break;
				// }
				// this.lastHit = obj.pID || obj.id;
				if(_o) _o.points += this.life <= 0 ? 1000 : 50;
			break;
			case 'enemy':
				if(obj.type !== 'eBullet')
						this.life -= 256;
				if(_o) _o.points += this.life <= 0 ? 100 : 10;
			break;
			case 'cargo':
				if(obj.type !== 'eBullet')
						this.life -= 64;
				if(_o) _o.points += this.life <= 0 ? 500 : 25;
			break;
			case 'pBullet':
			case 'eBullet':


				// this.life = -1;
				
				if(!this.dead) {
					game.removeObj(this.id);
					this.dead = true;
				};


			break;
		};
		this.hurt = Date.now();
	};
	
	//  a MUST BE SMALLER THAN b
	turnDir(a,b) {
		if(a>b) return -this.turnDir(b,a);
		return b-a < 2*PI - b + a ? b-a : -(2*PI - b + a);
	};
	turn(val,max) {
		if(Math.abs(val) > max) {
			if(val > 0)
				return max;
			else return -max;
		} else return val;
	};
	// targetDir() {
	// 	this.tDir.copy(mouse).sub(this.pos).unit();
	// }
};





//-------------------------------------------------------------------------------
//-------------------------------------------------------------------------------
//-------------------------------------------------------------------------------

function ObjectPool(object) {
	let pool = {};
	pool.active = [];
	pool.inactive = [];

	let tmp1 = [];
	let tmp2 = [];
	pool.newObject = function(options) {

		let _o;
		if(pool.inactive.length < 1) {
			_o = new object();
			_o.init(options);

			_o.release = () => {

				// _o.visible = false;
				pool.active.splice(pool.active.indexOf(_o),1);
				pool.inactive.push(_o);
				// if(server) {
				// 	tmp1 = [];
				// 	tmp2 = [];
				// 	pool.active.forEach(o => tmp1.push(o.id));
				// 	pool.inactive.forEach(o => tmp2.push(o.id));

				// }
			}
		} else {
			_o = pool.inactive.shift();
			_o.init(options);

			// _o.visible = true;
			
		};
		pool.active.push(_o);
		// if(server) {
		// 	tmp1 = [];
		// 	tmp2 = [];
		// 	pool.active.forEach(o => tmp1.push(o.id));
		// 	pool.inactive.forEach(o => tmp2.push(o.id));

		// }

		return _o;
	};
	return pool;
};

//-------------------------------------------------------------------------------
//-------------------------------------------------------------------------------
//-------------------------------------------------------------------------------

let rowResult,areaResult,
	_top, _bottom, _right,
	_row, _cells, _cell,
	matchResults, results,knownIDs;



let count = 10;
function BroadPhase(options) {
	let bp = {};
	bp.grid = [];

	//  ONLY USED FOR DEBUGGIN GRID I THINK
	bp.w = options.w;
	bp.h = options.h;

	bp.size = options.size;

	//  FOR DEBUG REMOVE LATER
	// bp.debugID = null;
	// bp.debugCells = [];

	//  FIND POINT IN GRID
	bp.findCell = function(point) {
		if(point) {
			return vec(
				Math.floor(point.x/bp.size),
				Math.floor(point.y/bp.size)
			)
		}
	};

	//  FIND ALL THE CELLS IN A ROW
	bp.findCellsRow = function(c1,c2) {
		rowResult = [];
		for(let i=0,iL=c2.x-c1.x+1; i<iL; i++)
			rowResult.push(vec(c1.x+i, c1.y));
		return rowResult;
	};

	bp.findCellsArea = function(obj) {
		areaResult = [];
		_top = bp.findCell({x:obj.pos.x - obj.w/2,y:obj.pos.y - obj.h/2});
		_right = bp.findCell({x:obj.pos.x+obj.w/2,y:obj.pos.y});
		_bottom = bp.findCell({x:obj.pos.x,y:obj.pos.y+obj.h/2});
		
		for(let i=0,iL=_bottom.y-_top.y + 1; i<iL; i++) {
			_row = bp.findCellsRow(
				vec(_top.x, _top.y + i),
				vec(_right.x, _top.y + i)
			);
			areaResult = areaResult.concat(_row)
		};

		//  FOR DEBUG, REMOVE LATER
		// if(bp.debugID
		// && bp.debugID === obj.id)
		// 	bp.debugCells = areaResult;

		return areaResult;
	};

	bp.addToGrid = function(obj) {
		_cells = bp.findCellsArea(obj);
		for(let i=0,iL=_cells.length; i<iL; i++) {
			_cell = _cells[i];
			if(!bp.grid[_cell.y])
				bp.grid[_cell.y] = [];
			if(!bp.grid[_cell.y][_cell.x])
				bp.grid[_cell.y][_cell.x] = [];
			bp.grid[_cell.y][_cell.x].push(obj);
		}
	};

	// bp.removeFromGrid = function(obj) {
	// 	_cells = bp.findCellsArea(obj);
	// 	_cells.forEach( cell => {


	// 		bp.grid[cell.y][cell.x].splice(bp.grid[cell.y][cell.x].indexOf(obj),1)
	// 	});
	// };

	bp.clearGrid = function() {
		bp.grid = [];
	};

	bp.populateGrid = function(objects) {
		// for(let i in objects) {
			// bp.addToGrid[objects[i]];
		// }
		objects.forEach( object => {
			bp.addToGrid(object)
		});
	};

	bp.findMatches = function(object) {
		matchResults = [];
		knownIDs = [];
		results = [];
		//  FIND THE CELLS OCCUPIED BY THE OBJECT
		_cells = bp.findCellsArea(object);

		//  CYCLE THROUGH THEM
		_cells.forEach(cell => {
			
			//  IF THE CELL IN QUESTION EXISTS
			if(bp.grid[cell.y] !== undefined
			&& bp.grid[cell.y][cell.x] !== undefined)
				//  CONCATENATE THE ARRAY AT THAT CELL TO THE RESULTS ARRAY 
				matchResults = matchResults.concat(bp.grid[cell.y][cell.x])
		});

		count--;
		//  CYCLE THROUGH RESULTS
		matchResults.forEach((obj,i) => {
			if(obj.id !== object.id
			&& results.indexOf(obj) === -1) {
				results.push(obj);
				// if(object.id === bp.debugID)
					// obj.debug = true;
			}
		});
		return results;
	};
	// bp.drawBroadPhaseGrid = function(context) {
	// 	let rows = Math.floor(bp.h/bp.size);
	// 	let cols = Math.floor(bp.w/bp.size);

	// 	context.strokeStyle = 'green';
	// 	for(let x=0; x<cols+1; x++) {
	// 		context.beginPath();
	// 		context.moveTo(x*bp.size,0);
	// 		context.lineTo(x*bp.size,bp.h);
	// 		context.stroke();
	// 	}
	// 	for(let y=0; y<rows+1; y++) {
	// 		context.beginPath();
	// 		context.moveTo(0,y*bp.size);
	// 		context.lineTo(bp.w,y*bp.size);
	// 		context.stroke();
	// 	}
	// 	if(bp.debugCells.length > 0) {
	// 		bp.debugCells.forEach(C => {
	// 			context.fillStyle = 'rgba(20,180,70,0.5)';
	// 			context.fillRect(C.x * bp.size,
	// 							 C.y * bp.size,
	// 							 bp.size,bp.size);
	// 		})
	// 	}
	// }
	return bp;
};

// let broadPhase = BroadPhase({
// 	w: 100,
// 	h: 100,
// 	size: 12
// })

//-------------------------------------------------------------------------------
//-------------------------------------------------------------------------------
//-------------------------------------------------------------------------------

function createGameLoop() {
    var simulationTimestep = 1000 / 60,
        gameTime = 0,
        frameDelta = 0,
        lastFrameTimeMs = 0,
        fps = 60,
        lastFpsUpdate = 0,
        framesThisSecond = 0,
        numUpdateSteps = 0,
        minFrameDelay = 0,
        running = false,
        started = false,
        panic = false,
        requestAnimationFrame = !server ? window.requestAnimationFrame : (function() {
            var lastTimestamp = Date.now(),
                now,
                timeout;
            return function(callback) {
                now = Date.now();
                timeout = Math.max(0, simulationTimestep - (now - lastTimestamp));
                lastTimestamp = now + timeout;
                return setTimeout(function() {
                    callback(now + timeout);
                }, timeout);
            };
        })(),
        cancelAnimationFrame = !server ? window.cancelAnimationFrame : clearTimeout,
        NOOP = ()=>{},
        begin = NOOP,
        update = NOOP,
        draw = NOOP,
        end = NOOP,
        rafHandle;

    let GameLoop = {
      
        // getSimulationTimestep: function() {
        //     return simulationTimestep;
        // },

        // setSimulationTimestep: function(timestep) {
        //     simulationTimestep = timestep;
        //     return this;
        // },

        // getFPS: function() {
        //     return fps;
        // },

        // getMaxAllowedFPS: function() {
        //     return 1000 / minFrameDelay;
        // },
        // setMaxAllowedFPS: function(fps) {
        //     if (typeof fps === 'undefined') {
        //         fps = Infinity;
        //     }
        //     if (fps === 0) {
        //         this.stop();
        //     }
        //     else {
        //         // Dividing by Infinity returns zero.
        //         minFrameDelay = 1000 / fps;
        //     }
        //     return this;
        // },
        // resetFrameDelta: function() {
        //     var oldFrameDelta = frameDelta;
        //     frameDelta = 0;
        //     return oldFrameDelta;
        // },
   //      setGameTime: function(gT) {
			// gameTime = gT;
   //      },
        setBegin: function(fun) {
            begin = fun || begin;
            return this;
        },
        setUpdate: function(fun) {
            update = fun || update;
            return this;
        },
        setDraw: function(fun) {
            draw = fun || draw;
            return this;
        },
        setEnd: function(fun) {
            end = fun || end;
            return this;
        },

        start: function() {
            if (!started) {
                started = true;
                rafHandle = requestAnimationFrame(function(timestamp) {
                    draw(1);

                    running = true;

                    lastFrameTimeMs = timestamp;
                    lastFpsUpdate = timestamp;
                    framesThisSecond = 0;

                    rafHandle = requestAnimationFrame(animate);
                });
            };
            return this;
        },

        stop: function() {
            running = false;
            started = false;
            cancelAnimationFrame(rafHandle);
            return this;
        }//,

        // isRunning: function() {
        //     return running;
        // },
    };

    function animate(timestamp) {
        rafHandle = requestAnimationFrame(animate);
        if (timestamp < lastFrameTimeMs + minFrameDelay)
        	return;
        frameDelta += timestamp - lastFrameTimeMs;
        lastFrameTimeMs = timestamp;
        begin(timestamp, frameDelta, gameTime);
        if (timestamp > lastFpsUpdate + 1000) {
            fps = 0.25 * framesThisSecond + 0.75 * fps;
            lastFpsUpdate = timestamp;
            framesThisSecond = 0;
        };
        framesThisSecond++;
        numUpdateSteps = 0;
        while (frameDelta >= simulationTimestep) {
            gameTime += simulationTimestep;
            update(simulationTimestep,gameTime);
            frameDelta -= simulationTimestep;
            if (++numUpdateSteps >= 240) {
                panic = true;
                break;
            }
        };
        draw(frameDelta / simulationTimestep);
        end(fps, panic);
        panic = false;
    };

    return GameLoop;
}





// Generate a palette
//  use -ss 30 -t 3 to skip 30 seconds and take the next 3
// ffmpeg -y  -i sf4.mov -vf fps=24,scale=480:-1:flags=lanczos,palettegen palette.png

//  Output a gif
// ffmpeg -y -i sf4.mov -i palette.png -ss 18 -t 10 -filter_complex "fps=60,scale=480:-1:flags=lanczos[x];[x][1:v]paletteuse" sf4.gif