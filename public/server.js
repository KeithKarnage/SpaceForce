"use strict";

/**
 * User sessions
 * @param {Array} matches
 */
const matches = [],
	users = [];

let matchID = 0,
	removeUser = user => {
		// console.log(user)
		if(user.match)
			user.end();
		// delete users[user.socket.id];
	};
/**
 * Find match for a user
 * @param {User} user to find match for
 */
function findMatch(user) {
	console.log('finding match')

	//  IF A MATCH IS FOUND IN matches, found WILL BE SET TO 1
	let found = 0;
	//  ITERATE THROUGH MATCHES
	matches.forEach(m => {
		console.log('Match users length',m.users.length);
		//  CANCEL CALL BACK IF MATCH HAS ALREADY BEEN FOUND
		if(found) return;
		//  IF THIS MATCH HAS LESS THAN x USERS
		//  AND THE USER HASN'T ALREADY GOT A MATCH
		if(m.users && m.users.length < 10
		&& !user.match) {
			console.log(user.socket.id,'joining match,',m.id);
			//  TELL THE USER TO JOIN THE MATCH
			user.join(m);
			//  ITERATE found TO STOP FURTHER COMPUTATION
			found++
		}
	})
	//  IF NO MATCH WAS FOUND
	if(!found) {
		//  CREATE A NEW ONE
		let M = new Match();
		M.id = matchID++;
		console.log(user.socket.id,'joining match,',M.id);
		//  PUT IT IN matches
		matches.push(M);
		//  TELL THE USER TO JOIN IT
		user.join(M);
	}
}

/**
 * Remove user session
 * @param {User} user
 */
// function removeUser(user) {
// 	matches.splice(matches.indexOf(user), 1);
// }

/**
 * Match class
 */
class Match {

	/**
	 * @param {}
	 */
	constructor() {
		//  LIST OF USERS
		this.users =  [];
		this.game = new Game(true);
	}

	/**
	 * @param {user} user joining the match
	 */
	join(user) {
		//  ADD JOINING user TO THE USER LIST
		this.users.push(user);
		this.game.addPlayer(user.socket.id,user);
	}

	/**
	 * @param {}
	 */
	leave(user) {
		this.users.splice(this.users.indexOf(user),1);
		this.game.removePlayer(user.socket.id);
		if(this.users.length === 0) {
			console.log('ending')
			this.game.GL.stop();
			// this.game = null;
			matches.splice(matches.indexOf(this));
		}

		// if(Object.keys(this.game.players).length < 1)
			// matches.splice(matches.indexOf(this),1);
	}
}

/**
 * User session class
 */
class User {

	/**
	 * @param {Socket} socket
	 */
	constructor(socket) {
		this.socket = socket;
		this.match = null;
	}

	/**
	 * Start new match
	 * @param {Match} match
	 */
	start() {
		this.match = match;
		this.socket.emit("start");
	}

	/**
	 * Join a match
	 * @param {Match} match to join
	 */
	join(match) {
		this.socket.emit('joined')
		this.match = match;
		match.join(this);
		
	}

	/**
	 * Terminate match
	 */
	end() {
		this.match.leave(this);
		this.match = null;
		this.socket.emit("end");
	}
}



/**
 * Socket.IO on connect event
 * @param {Socket} socket
 */
module.exports = {

	io: (socket) => {
		const user = new User(socket);
		users[socket.id] = user;
		// findMatch(user);

		socket.on("disconnect", () => {
			console.log("Disconnected: " + socket.id);
			removeUser(user);
			
		});

		socket.on('join', o => {
			findMatch(user)
		});

		socket.on('input', I => {
			if(user.match)
				user.match.game.receiveInput(I);
		});

		// socket.on("guess", (guess) => {
		// 	console.log("Guess: " + socket.id);
		// 	if (user.setGuess(guess) && user.game.ended()) {
		// 		user.game.score();
		// 		user.game.start();
		// 		storage.get('games', 0).then(games => {
		// 			storage.set('games', games + 1);
		// 		});
		// 	}
		// });

		console.log("Connected: " + socket.id);
	}//,

	// stat: (req, res) => {
	// 	storage.get('games', 0).then(games => {
	// 		res.send(`<h1>Matchs played: ${games}</h1>`);
	// 	});
	// }

};