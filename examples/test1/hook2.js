var beanpoll = require("beanpoll"),
haba = require("haba"),
router = beanpoll.router();





router.on({
	
	/**
	 */
	
	'push -hook hook1/ready': function()
	{
		console.log('hook 1 ready!');
		this.from.push('test')
	},


	/**
	 */

	'push -hook test3 -> test2': function() {
		console.log("TEST 2")
		this.next();
	}
	
});


haba.loader().
options(router, true).
params({
	index: {
		remoteName: 'hook2',
		transport: {
			rabbitmq: {
				host: 'localhost'
			}
		}	
	}
	
}).
require(__dirname + '/../../lib/index.js').
init();

router.push('init');