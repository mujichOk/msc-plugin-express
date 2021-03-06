const util = require('util');
const http = require('http');

const Express = require('express');
const ExpressRouter = require('express-promise-router');
const ExpressBodyParser = require('body-parser');

module.exports = PluginFactory;


function PluginFactory({
    suppressDefaultOnStart = false,
    suppressDefaultOnStop = false,
    suppressDefaultBodyParser = false
} = {}) {

    return {
        onPreInit,
        onInit,
        onStart,
        onStop
    };


    function onPreInit(context) {
        context.express = {};
        context.express.app = Express();

        if (!suppressDefaultBodyParser) {
            context.express.app.use(ExpressBodyParser.json({ type: 'application/json' }));
        }

        context.http = context.http || {};
        context.http.server = http.createServer(context.express.app);
    }

    function onInit(context) {
        const router = ExpressRouter();

        Object
            .keys(context.call)
            .filter((key) => util.isFunction(context.call[key]) && context.call[key].meta && context.call[key].meta.express)
            .forEach(register);

        context.express.app.use('/', router);


        function register(key) {
            const method = context.call[key];
            const meta = method.meta.express;
            const verb = meta.verb || 'get';
            const methodArgsMapping = meta.args || [];
            const route = meta.route || `/${key}`;

            switch (verb) {
                case 'get':
                case 'post':
                case 'put':
                case 'patch':
                case 'delete':
                    return router[verb](route, handler);
                case '*':
                    return router.use(route, handler);
                default:
                    throw new Error(`not supported verb`);
            }


            async function handler(req, res, next) {
                const args = methodArgsMapping.reduce((args, key) => {
                    if (key === 'body') {
                        return args.concat(req.body);
                    } else if (key === 'params') {
                        return args.concat(req.params);
                    } else if (key === 'query') {
                        return args.concat(req.query);
                    } else if (key.startsWith('params.')) {
                        return args.concat(req.params[key.slice('params.'.length)]);
                    } else if (key.startsWith('query.')) {
                        return args.concat(req.query[key.slice('query.'.length)]);
                    }
                    return args;
                }, []);

                const value = await method.apply(null, args);

                if (value) {
                    return res.json(value).end();
                }

                return res.status(200).end();
            }
        }

    }

    async function onStart(context) {
        if (suppressDefaultOnStart) {
            return;
        }

        const port = await context.get('http.port');

        return new Promise((resolve, reject) => {
            context.http.server
                .listen(port, resolve)
                .on('error', reject);
        });
    }

    function onStop(context) {
        if (suppressDefaultOnStop) {
            return;
        }

        return new Promise((resolve, reject) => {
            context.http.server
                .close(resolve)
                .on('error', reject);
        });
    }

}