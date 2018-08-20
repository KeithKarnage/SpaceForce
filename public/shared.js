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
	_sTime = 0,  //  LAST TIME STATE WAS SENT
	// _states,  //  ALL STATES EVER REVEIVED
	input = [],  //  INPUT FOR ALL ON SERVER, OTHERS ON CLIENT
	_actors = [],  //  AN ARRAY FOR ACTORS FOR STUPID REASONS
	cInput,  //  CLIENT INPUT
	lR = 0,  //  LAST ROTATION OF CLIENT PLAYER

	_i, _iI,  //  CACHED INPUT VARIABLES
	_b, _bI,  //  CACHED BULLET VARIABLES
	 _tV,  //  A TEMPORARY VECTOR USED FOR BULLETS AND MOVEMENT
	// iID = 0,
	_hit,  //  COLLISION VARIABLE
	_hw,

	cList = [],  //  COLLISION LIST
	cTypes = {},  //  THE TYPES OF OBJECTS COLLIDING
	rnd = (val) => { return Math.floor(val*1000)/1000 };



//-------------------------------------------------------------------------------
//-------------------------------------------------------------------------------
//-------------------------------------------------------------------------------

class Game {
	constructor(S,id) {
		//  IS THIS INSTANCE RUNNING ON THE SERVER
		server = S;
		game = this;
		this.states = [];
		//  CANVAS DRAWING CONTEXT, undefined ON SERVER
		// ctx = C
		//  ID FOR THIS INSTANCE
		this.id = id;
		//  LIST OF PLAYERS IN THE GAME
		this.players = {};
		this.actors = {};
		//  THE CLIENT'S PLAYER
		this.player = null;
		if(!server) {
			this.cam = new Obj();
		}


		// this.stage = new Obj();
		// this.stage.w = 1000;
		// this.stage.h = 1000;
		// this.stage.fS = 'rgba(0,0,0,0)';
		this.bp = new BroadPhase({w:1000,h:1000,size:24});
		this.bullets = ObjectPool(Obj);

		//  INIT CACHED TEMPORARY VECTOR
		_tV = vec();

		_hit = vec();
		// _rsp = vec();

		this.GL = createGameLoop();
		this.GL.setBegin(this.begin);
		this.GL.setUpdate(this.update);
		this.GL.setEnd(this.end);
		if(!server)
			this.GL.setDraw(this.render);
		setTimeout(this.GL.start,100);

	}
	//--  --  --  --  --  --  --  --  --  --  --  --  --  --  --  --  --
	addPlayer(id,p) {
		p = p || {};

		//  MAKE NEW PLAYER AND ASSIGN IT TO this.players
		_p = this.players[id] = new Obj(id,p.socket,Math.random()*95,Math.random()*95);
		this.actors[id] = _p;

		//  THE CLIENT'S PLAYER
		if(id === this.id) {
			this.player = _p;
			//  FOR DEBUG REMOVE LATER
			this.bp.debugID = id;
		}

		//  IF THIS INSTANCE IS RUNNING ON THE SERVER
		//  SEND THE STATE OUT TO INFORM EVERYONE OF THE NEW PLAYER
		if(server) this.sendState()
	}
	removePlayer(id) {

		_p = this.players[id];

		if(_p) {
			delete this.actors[id];
			// this.actors.splice(this.actors.indexOf(_p),1);
			// console.log(id,this.id)
			if(id === this.id) {
				console.log('ending game');
				// endGame();
			}
			delete this.players[id];
			if(server) {
				removeUser(users[id]);
				this.sendState();
			}
		}
	}
	//--  --  --  --  --  --  --  --  --  --  --  --  --  --  --  --  --
	sendState() {

		//  RESET THE STATE
		_state = {
			rT: Date.now()
		};
		//  MAKE AN ENTRY RECORDING THE X AND Y FOR EACH ACTOR
		for(_pI in this.actors) {
			_p = this.actors[_pI];
			_state[_p.id] = [_p.pos.x,
							_p.pos.y,
							_p.vel.x,
							_p.vel.y,
							_p.dir,
							_p.type.substr(1,1) === 'B' ? _p.pID : _p.input,
							_p.type.substr(0,2),
							_p.life
			];
			// if(_p.tookDamage) {
			// 	_state[_p.id][7] = 1;
			// 	_p.tookDamage = false;
			// }
		}

		//  SEND THE STATE TO EACH PLAYER
		for(_pI in this.players)
			this.players[_pI].socket.emit('state',_state);
	}
	receiveState(S) {
		game.states.push(S);
	}
	applyState(S) {
		// _states.push(S);
		//  FOR EACH OBJECT INDEX IN THE STATE
		for(_oI in S) {
			// console.log(_oI)

			//  SKIP THE GAME TIME AND REAL TIME ENTRIES
			// if(_oI === 'gT' || _oI === 'rT') continue;
			if(_oI === 'rT') continue;

			//  THE OBJECT
			_o = S[_oI];
			// console.log(_oI)
			//  IF THE OBJECT INDEX IS NOT INCLUDED IN this.players, MAKE A NEW PLAYER
			//  addPlayer() SETS _p TO THE MOST RECENTLY CREATED PLAYER
			switch(_o[6]) {
				case 'pl':
					//  FIND ID IN PLAYERS LIST
					_p = this.players[_oI];
					//  IF IT ISN'T THERE, MAKE A NEW PLAYER
					if(!_p) this.addPlayer(_oI);

					//  IF IT IS THE CLIENT'S PLAYER AND THEY TOOK DAMAGE
					if(_oI === game.id
					&& _o[7] < _p.life) {
						_p.life = _o[7];
					// console.log(_p.life,_o[7])
						cam.shake();
					}

				break;
				case 'pB':
				case 'eB':
					//  FIND ID IN ACTOR LIST
					_p = game.actors[_oI];
					//  IF IT ISN'T THERE
					if(!_p) {
						//  MAKE A NEW BULLET
						_p = game.fireBullet(0,_o,_oI);
						//  IF IT IS THE CLIENT PLAYER'S BULLET, SHAKE CAM
						if(_o[5] === game.id)
							cam.shake(game.player.dir);
					}
				break;
			}
			if(_p){
				_p.pos.x = _o[0];
				_p.pos.y = _o[1];
				_p.vel.x = _o[2];
				_p.vel.y = _o[3];
				_p.dir = _o[4];
				//  FOR BULLETS, INPUT ACTS AS THE PARENT ID
				_p.input = _o[5];
			}
		}
		//  REMOVE ANY OBJECTS NOT INCLUDED IN THE STATE
		for(_pI in this.actors) {
			_p - this.actors[_pI];
			if(_p && !S[_pI]) {
				
				_p = this.actors[_pI];
				switch(_p.type) {
					case 'player':
						this.removePlayer(_pI);
					break;
					case 'pBullet':
					case 'eBullet':
						this.removeBullet(_p);
					break;
				}
			}
			// console.log(_pI,this.players[_pI])
			
		}
	}
	//--  --  --  --  --  --  --  --  --  --  --  --  --  --  --  --  --
    sendInput () {
    	_p = game.player;
    	if(!_p) return;
    	//  1 - FIRING
    	//  2 - X AXIS
    	//  3 - Y AXIS
    	//  4 - ROTATION
    	//  5
        cInput = [socket.id,0,0,0,0];

        //  IF MOUSE IS PRESSED, SPACE BAR IS PRESSED, OR A SECOND TOUCH IS HAPPENING
		if(mouse.pressed  || keys[32] || touchIDs[1])
			cInput[1] = 1;
		

		//  RECORD AXIS (ARROWS/WASD/ZQSD OR FIRST TOUCH)
		
		//  USE TEMPORARY VECTOR FOR INPUT
		_tV.clr();

		//  IF THERE IS A FIRST TOUCH
		_tID = touchIDs[0];
		if(_tID) {
			//  THE TOUCH
			_t = touches[_tID];
			//  THE TOUCHES POSITION
			_tP = touchPos(_t);
			//  COPY THE TOUCH POSITION, THEN SUBTRACT THE PLAYER POSITION
			//  TO GET A VECTOR POINTING FROM THE PLAYER TO THE TOUCH
			_tV.copy(_tP).sub(game.player.pos);
		}
		//  KEYBOARD
		else {
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
	    }

		_tV.unit();
		cInput[2] = _tV.x;
		cInput[3] = _tV.y;



        // if(game.player) {
        //  RECORD DIRECTION PLAYER IS FACING (TOWARD MOUSE OR SECOND TOUCH)
        	cInput[4] = game.player.tgt.dir();
        // }
        if(cInput[1] || cInput[2] || cInput[3] || cInput[4] !== lR) {
	        //  INPUT ID
	        // cInput[1] = iID++;
            socket.emit('input',cInput)
            //  LAST ROTATION (SO WE KNOW IF THE NEXT ONE IS DIFFERENT)
            lR = cInput[4];
            // console.log(cInput)
        }
    }
	receiveInput(I) {

		//  FIRST INDEX IS PLAYER ID
		//  IF IT DOESN'T EXIST IN input
		if(!input[I[0]])
			//  MAKE AN ARRAY TO HOLD INPUT FROM THIS PLAYER
			input[I[0]] = [];

		//  PUSH THE INPUT TO THAT ARRAY
		input[I[0]].push(I);
	}
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
	}
	fireBullet(p,b,id) {
		if(server) {
			if(!p.firing) {
				p.firing = true;
				p.fTime = Date.now();
				//  SET TEMP VECTOR TO THE PLAYER (THAT IS SHOOTING) DIRECTION FACING
				_tV.vFrD(p.dir).scl(16);
				//  MAKE NEW BULLET
				_b = game.bullets.newObject({
					type: p.type === 'player' ? 'pBullet' : 'eBullet',
					x: p.pos.x+_tV.x,
					y: p.pos.y+_tV.y,
					dir: p.dir,
					vx: p.vel.x + _tV.x,
					vy: p.vel.y + _tV.y,
					pID: p.id
				})
			}
		} else {
			//  CLIENT SIDE JUST MAKE NEW BULLET WITH DATA FROM STATE
			_b = game.bullets.newObject({
				type: b[6] === 'pB' ? 'pBullet' : 'eBullet',
				x: b[0],
				y: b[1],
				id: id,
				pID: b[5]
			})
		}
		//  SET WIDTH OF BULLET
		_b.w = 12;
		//  ADD BULLET TO ACTOR LIST
		game.actors[_b.id] = _b;
		return _b;		
	}
	removeBullet(b) {
		b.release();
		delete game.actors[b.id];
	}
	
	//--  --  --  --  --  --  --  --  --  --  --  --  --  --  --  --  --
	begin(ts,fD,gT) {
		if(!game) return;
		if(!server) {
			_tID = touchIDs[1] || touchIDs[0];
			if(_tID)
				mouse.copy(touchPos(touches[_tID]));
			// else game.player.tgt = null;
			//  SET CLIENT PLAYERS TARGET TO MOUSE COORDS
			if(game.player)
				game.player.targetDir();
			game.sendInput();
		}
		else {
			if(gT - _sTime > 70)
				game.sendState();
				// game.sendState(gT);
		}
		
	}
	update(ts,gT) {
		if(!game) return;
		
		//  ON THE SERVER
		if(server) {
			//  FOR EACH ACTOR
			for(_pI in game.actors) {
				_p = game.actors[_pI];
				_p.input = false;
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
							if(_i[1] && !_p.firing)
								game.fireBullet(_p);
						}
						_p.input = true;
					}
				}
				//  UPDATE ACTOR
				_p.update(ts);
			}
			//  REGISTER NEW POSITIONS IN BROADPHASE GRID
			game.bp.clearGrid();
			_actors = [];
			Object.keys(game.actors).forEach(key => {
				_actors.push(game.actors[key]);
			})
			game.bp.populateGrid(_actors);
				// console.log("COLLISION")
			let N = Date.now();
			for(_pI in game.actors) {
				_p = game.actors[_pI];					
				cList = game.bp.findMatches(_p);

				cList.forEach( obj => {

					if(game.checkCollision(_p,obj)) {
						if(_p.pID === obj.id
						|| obj.pID === _p.id
						|| obj.collidedWith[_p.id]
						|| _p.collidedWith[obj.id])
							return;

						// console.log('hit      ',N,_p.id,obj.id);
						if(obj) obj.collided(_p);
						if(_p) _p.collided(obj);	
					}
				});
			}
		//  ON THE CLIENT
		} else {
	        // if(!game.player) return;

			
			//  UPDATE EACH PLAYER
			for(_pI in game.players)
				game.players[_pI].update(ts);
			//  IF THERE ARE ANY STATES FROM THE SERVER
			for(_sI=0; _sI < game.states.length; _sI++) {
				_s = game.states[_sI];
				//  IF IT IS TIME
				if(Date.now() > _s.rT + 100) {
					game.applyState(_s);
					game.states.shift();
					_sI--;
				} else continue;
			}
			if(game.player) {
				// console.log(game.player.dir)
				cam.follow(ts);
			}
		}
		
	}
	render() {
		if(!game) return;
		ctx.save();
		ctx.scale(scale,scale);
		ctx.fillStyle = 'rgb(20,20,20)';
		ctx.fillRect(0,0,cam.w,cam.h);
		ctx.translate(-cam.pos.x + cam.shk.x,-cam.pos.y + cam.shk.y);
		

		//  DRAW GRID FOR DEBUGGING
		game.bp.drawBroadPhaseGrid(ctx);
		// displayObj(game.stage);

		// game.actors.forEach( a => displayObj(a) );
		for(_pI in game.actors)
			displayObj(game.actors[_pI]);

		
		ctx.restore();
		ctx.fillStyle = 'white';
		if(game.player)
			ctx.fillText(game.player.life,10,10)
	}
	end() {
		if(!game) return;
		for(_pI in game.actors) {
			_p = game.actors[_pI];
			_p.debug = false;
			_p.collidedWith = {};
		}
		// game.actors.forEach(A => {
		// 	A.debug = false;
		// })
	}
}




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
}


//-------------------------------------------------------------------------------
//-------------------------------------------------------------------------------
//-------------------------------------------------------------------------------


class Obj {
	constructor(id,S,x,y,w,h) {
		//  user REFERENCE FOR SERVER, undefined ON CLIENT INSTANCES
		this.socket = S;
		this.id = id || objID++;

		this.type = 'player';

		this.life = 1000;
		// this.tookDamage = false;

		//  FILL STYLE
		this.fS = 'hsl('+Math.floor(Math.random()*256)+',100%,50%)';

		this.pos = vec(x,y);
		this.vel = vec();
		//  this.tgt IS REUSED ON SERVER AS A SCALAR TARGET DIRECTION VALUE
		this.tgt = vec();
		this.axis = vec();
		this.dir = 0;
		this._d;  //  CACHED DIRECTION VARIABLE
		// this.x = Math.floor(Math.random()*95);
		// this.y = Math.floor(Math.random()*95);

		//  ROTATION
		// this.r = 0;
		this.tSpd = 10;
		//  WIDTH HEIGHT
		this.w = w || 16;
		this.h = h || 16;

		//  FIRING SPEED / TIMER
		this.firing = 0;
		this.fSpeed = 200;
		this.fTime = 0;

		//  INPUT THIS CYCLE
		//  GETS REUSED FOR PARENT ID
		this.input = false;  

		this.collidedWith = {};

		this.debug = false;


	}
	//  ONLY CALLED ON POOLED OBJECTS
	init(o) {
		// console.log(o)
		this.type = o.type;
		this.life = 1000;
		this.pos.copy(o);
		this.vel.x = o.vx;
		this.vel.y = o.vy;
		this.id = o.id || this.id;
		this.pID = o.pID;

	}
	update(ts) {

		//  PROCESS MOVEMENT
		this.pos.add(this.vel);


		//   ADD FRICTION
		// if(!this.input && this.type === 'player' || this.type === 'enemy') {
		// 	console.log('applying friction')
		// 	this.vel.x *= 0.98;
		// 	this.vel.y *= 0.98;
		// }


		//  PROCESS TURNING
		//  THE DIRECTION WE ARE FACING AND THE DIRECTION THE INPUT WANTS TO FACE
		//  BOTH FROM -PI TO PI, ADD PI TO MAKE FROM 0 TO 2PI
		if(server) {
			this._d = this.turnDir(this.dir+PI, this.tgt+PI);
			if(this._d) {
				// console.log(this.tgt,this.dir,PI)
				// console.log(this.dir,this._d)

				this._d = this.turn(this._d,this.tSpd *ts/1000);
				// console.log(this.dir+=this._d)
				this.dir = (this.dir + this._d) % (2 * PI);
			}

			//  COUNT DOWN BULLET LIFE AND REMOVE
			switch(this.type) {
				case 'pBullet':
				case 'eBullet':
					this.life -= Math.floor(ts);
					if(this.life <= 0)
						game.removeBullet(this);
				break;
				case 'player':
					if(this.life <= 0)
						game.removePlayer(this.id);
				break;
			}

		}



		//  RESET FIRING VARIABLE
		if(this.firing && Date.now() > this.fTime + this.fSpeed)
			this.firing = false;
	}
	collided(obj) {
		// console.log('collided', this.id)
		this.collidedWith[obj.id] = true;
		switch(this.type) {
			case 'player':
				switch(obj.type) {
					case 'eBullet':
					case 'pBullet':
						// this.tookDamage = true;
						this.life -= 50;
						// console.log(this.life);
					break;
				}
			break;
			case 'pBullet':
			case 'eBullet':
			// console.log('removing bullet',this.id)
			// console.log(Object.keys(game.actors));
				// this.life = -1;
				game.removeBullet(this);
			// console.log(Object.keys(game.actors));


			break;
		}
	};
	processInput(I,ts) {
		//  APPLY INPUT
		this.vel.x += I[2] * ts/1000;
		this.vel.y += I[3] * ts/1000;
		this.tgt = I[4];
	}
	//  a MUST BE SMALLER THAN b
	turnDir(a,b) {
		if(a>b) return -this.turnDir(b,a);
		return b-a < 2*PI - b + a ? b-a : -(2*PI - b + a);
	}
	turn(val,max) {
		if(Math.abs(val) > max) {
			if(val > 0)
				return max;
			else return -max;
		} else return val;
	}
	targetDir() {
		this.tgt.copy(mouse).sub(this.pos).unit();
	}
}





//-------------------------------------------------------------------------------
//-------------------------------------------------------------------------------
//-------------------------------------------------------------------------------

function ObjectPool(object) {
	let pool = {};
	pool.active = [];
	pool.inactive = [];
	pool.newObject = function(options) {

		let o;
		if(pool.inactive.length < 1) {
			o = new object();
			o.init(options)
			// console.log('new',pool.active.length,pool.inactive.length,pool);
			o.release = () => {
				o.visible = false;
				pool.active.splice(pool.active.indexOf(o),1);
				pool.inactive.push(o);
				// console.log('release',pool.active.length,pool.inactive.length);
			}
		} else {
			// console.log('reuse',pool.active.length,pool.inactive.length);
			o = pool.inactive.shift();
			o.init(options);
			o.visible = true;
		}
		// o.birth = timeStamp;
		pool.active.push(o);

		return o;
	};
	return pool;
}

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
	bp.debugID = null;
	bp.debugCells = [];

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
			)
			areaResult = areaResult.concat(_row)
		}

		//  FOR DEBUG, REMOVE LATER
		if(bp.debugID
		&& bp.debugID === obj.id)
			bp.debugCells = areaResult;
		// console.log(areaResult);
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
	// 		// console.log(cell,bp.grid[cell.y],bp.grid[cell.y][cell.x]);
	// 		// console.log(cell.x,cell.y,bp.grid)
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
			&& bp.grid[cell.y][cell.x] !== undefined) {
				//  CONCATENATE THE ARRAY AT THAT CELL TO THE RESULTS ARRAY 
				matchResults = matchResults.concat(bp.grid[cell.y][cell.x])
			}
		})

		count--;
		//  CYCLE THROUGH RESULTS
		matchResults.forEach((obj,i) => {
			if(obj.id !== object.id
			&& results.indexOf(obj) === -1) {
				results.push(obj);
				if(object.id === bp.debugID)
					obj.debug = true;
			}
			// if(count > 0)
			// 	console.log(obj.id === object.id);
			// if(obj.id === object.id
			// || knownIDs[obj.id]) {
			// 	matchResults.splice(i,1);
			// 	// return;
			// } else {
			// 	if(count > 0)
			// 		console.log('adding')
			// 	knownIDs[obj.id] = obj.id;
			// }
		});
		return results;
	};
	bp.drawBroadPhaseGrid = function(context) {
		let rows = Math.floor(bp.h/bp.size);
		let cols = Math.floor(bp.w/bp.size);
		// console.log(this)
		context.strokeStyle = 'green';
		for(let x=0; x<cols+1; x++) {
			context.beginPath();
			context.moveTo(x*bp.size,0);
			context.lineTo(x*bp.size,bp.h);
			context.stroke();
		}
		for(let y=0; y<rows+1; y++) {
			context.beginPath();
			context.moveTo(0,y*bp.size);
			context.lineTo(bp.w,y*bp.size);
			context.stroke();
		}
		if(bp.debugCells.length > 0) {
			bp.debugCells.forEach(C => {
				context.fillStyle = 'rgba(20,180,70,0.5)';
				context.fillRect(C.x * bp.size,
								 C.y * bp.size,
								 bp.size,bp.size);
			})
		}
	}
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
        NOOP = function() {},
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
            }
            return this;
        },

        stop: function() {
            running = false;
            started = false;
            cancelAnimationFrame(rafHandle);
            return this;
        },

        isRunning: function() {
            return running;
        },
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
        }
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
        }
        draw(frameDelta / simulationTimestep);
        end(fps, panic);
        panic = false;
    }

    return GameLoop;
}