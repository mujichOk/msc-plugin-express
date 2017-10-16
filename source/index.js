const util = require('util');
const http = require('http');
const express = require('express');
const bodyParser = require('body-parser');

module.exports = pluginFactory;


function pluginFactory({
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
        context.express.app = express();

        if (!suppressDefaultBodyParser) {
            context.express.app.use(bodyParser.json({ type: 'application/json' }));
        }

        context.http = context.http || {};
        context.http.server = http.createServer(context.express.app);
    }

    function onInit(context) {

        Object
            .keys(context.call)
            .filter((key) => util.isFunction(context.call[key]) && context.call[key].meta && context.call[key].meta.express)
            .forEach(register);

        function register(key) {
            const method = context.call[key];
            const meta = method.meta.express;
            const verb = meta.verb || 'get';
            const route = meta.route || `/${key}`;

            switch (verb) {
                case '*':
                    return context.express.app.use(route, handler);
                case 'get':
                    return context.express.app.get(route, handler);
                case 'post':
                    return context.express.app.post(route, handler);
                case 'put':
                    return context.express.app.put(route, handler);
                case 'patch':
                    return context.express.app.patch(route, handler);
                case 'delete':
                    return context.express.app.delete(route, handler);

                default:
                    throw new Error('not supported verb');
            }


            function handler(req, res, next) {

                method({ data: req.body, ...req.params, ...req.query })
                    .then(onSuccess, next);


                function onSuccess(value) {
                    if (!value) {
                        return res.status(200).end();
                    }

                    return res.json(value).end();
                }

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