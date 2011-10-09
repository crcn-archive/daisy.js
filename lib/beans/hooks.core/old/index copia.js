var Hook = require('./hook'),
vine = require('vine'),
idGen = require('cashew').register('hook'),
Url = require('url');

/*

params = {
	name: 'name-of-application-must-be-unique',
	key: 'key-to-cluster',
	path: 'path/to/cluster' 
}


name:
the name of the application is an identifier for other applications to be notified when a particular instance goes online

key:
key used to hook into other apps

path:
apps can also be bundled up into clusters which have the ability to talk to one another. bottom-most apps have the ability to fetch channels all the way to the root, but not vice-versa. This 
is good for applications which may share the same channels, and communicate to the same app (e.g: message-queue, or bus). A path needs to be drawn back to the target app. 

the path is constructed as such:

path + / + name;

*/

	
exports.plugin = function(router, params)
{
	var oldAddChannel = router.addChannel, 
	readyBeans = {},
	identifier = idGen.random(),
	hooks = [];
                                                             
	
	router.addChannel = function(path, expr)
	{
		oldAddChannel.apply(router, arguments);

		if(!expr.meta.hooked) pushHook('add', { path: path, meta: expr.meta });
	}

	function init()
	{
        router.pullMulti('hook/transport', onHookTransport);
	}
    
    function onHookTransport(transport)
    {
    	var hook = new Hook(transport, router);
    	hook.id = identifier;
        hooks.push(hook);
    }
    

	function onBeanReady(data)
	{
		var ops = {};

		if(typeof data == 'string')
		{
			ops.name = data;
		}
		else
		{
			ops = data;
		}


		readyBeans[ops.name] = ops;

		router.on('pull ' + ops.name + '/ready', { meta: { 'public': 1, 'rotate': 1 } }, function()
		{
			return ops;
		});


		router.push(ops.name + '/ready', ops);
	}


	function addHook(value)
	{
		var data = {};

		if(typeof value == 'string')
		{
			var parts = Url.parse(value);

			data.protocol = parts.protocol ? parts.protocol.split(':').shift() : null;
			data.hostname = parts.hostname;
			data.port = parts.port;
		}
		else
		{
			data = value;
		}

		//TODO: get default port
		if(!data.port) data.port = 80;
		if(!data.protocol) data.protocol = 'http';

		for(var i in hooks)
		{
			var hook = hooks[i];

			if(hook.test && hook.test(data))
			{
				hook.hook(data);
			}
		}
	}


	function getHook(data)
	{
		var d = data || {};

		var channels = [],
			ch = router.channels();

		for(var channel in ch)
		{
			var expr = ch[channel];

			//make sure not to use any networked call
			if((!d.all && expr.meta.hooked) || !expr.meta['public']) continue;


			channels.push({ meta: expr.meta, path: channel });
		}


		var info = {
			id: identifier,
			channels: channels
		}

		return info;
	}

	function pullHook(request)
	{
		return vine.list(getHook(request.data)).end();
	}

	function pushHook(action, channel)
	{ 
		if(!action) return;

		router.push('hook', vine.method(action).result(channel || {}).end() , { meta: { passive: 1 } });
	}



	function setId(value)
	{
		identifier = value;


		for(var i = hooks.length; i--;)
		{
			hooks[i].id = identifier;
			hooks[i].sendHooks();
		}
	}

	function onConnection(data)
	{

		for(var bean in readyBeans)
		{                                               
			this.from.push(bean + '/ready', readyBeans[bean], { ignoreWarning: true });
		}
	}

	function pullHookSource(data)
	{
		
	}

	router.on({
		'push init': init,

		//ready part of the app which gets forwarded to other hooks
		'push ready/:name OR ready': onBeanReady,

		//returns the hookable channels
		'pull hook': pullHook,

		//adds a direct hook
		'push hook/add': addHook,

		//the key for the cluster / user / computer
		'push hook/set/id OR set/id': setId,

		//happens when a new hook is established
		'push hook/connection': onConnection,

		//pulls the sources of any given channel
		'pull hook/source': pullHookSource,
        
        //transports for the hooks
        'push hook/transport': onHookTransport
	});
}