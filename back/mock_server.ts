/* globals require, module, console  */
'use strict';

import  * as _ from 'lodash';
import * as express from 'express';
import * as cors from 'cors';
import * as ramlMocker from 'raml-mocker';
import * as colors from 'colors'; // colors/safe

class RamlMockServer {

    private options;
    private requestsMap = {};
    private app;
    private server;
    private defaults = {
        port: 3030,
        path: 'raml',
        prefix: '',
        prioritizeBy: 'schema', // example, todo:order
        debug: true // shows logs
    };

    constructor() {
        this.addRoute = this.addRoute.bind(this);
    }

    init (prefs: any, callback: any) {
        this.options = _.extend(this.defaults, prefs);
        this.app = this.options.app || express();
        this.app.use(cors());

        ramlMocker.generate(this.options, this.process( (requestsToMock) => {
            requestsToMock.forEach( (reqToMock) => {
                this.addRoute(reqToMock);
            });
            this.log(new Array(30).join('='));
            this.log(colors.cyan('[' + requestsToMock.length + ']') + ' API routes generated');

            if(typeof callback === 'function'){
                callback(this.app);
            }
        }));

        // var watcher = watch();
        this.server = this.launchServer();
    }
    close () {
        // if (watcher) { watcher.close(); }
        if (this.server !== null) { this.server.close(); }
    }

    private log(msg: string) {
        if(this.options.debug){
            console.log(msg);
        }
    }


    private process(callback: any) {
        return (requestsToMock) => {
            requestsToMock.forEach((reqToMock) => {
                this.requestsMap[reqToMock.method + '!' + reqToMock.uri] = reqToMock;
            });
            if(typeof callback === 'function'){
                callback(requestsToMock);
            }
        };
    }


    private launchServer() {

        // intercept OPTIONS method
        this.app.options('*', function(req: any, res: any) {
            res.status(200).send();
        });

        if (!this.options.app) {

            // set static location
            if(this.options.staticPath){
                this.app.use(express.static(this.options.staticPath));
            }


            // CORS middleware
            if(this.options.cors){
                this.app.use(function(req: any, res: any) {
                    res.header('Access-Control-Allow-Origin', '*');
                    res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE');
                    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
                });
            }


            this.log('Listening on port ' + this.options.port);
            return this.app.listen(this.options.port);
        }
    }

    private addRoute(reqToMock: any) {

        var prefixes = _.isArray(this.options.prefix) ? this.options.prefix : [this.options.prefix];
        var method = reqToMock.method;

        this.log(colors.cyan(method + '\t' + reqToMock.uri));

        prefixes.forEach( (prefix) => {
            var uri = prefix + reqToMock.uri;

            this.app[method](uri, (req,res) => {
                var mockObj = this.requestsMap[method + '!' + reqToMock.uri];
                if(mockObj){
                    var mock = mockObj.mock && mockObj.mock();
                    var example = mockObj.example && mockObj.example();
                    var response =  this.options.prioritizeBy === 'example' ?
                            example || mock :
                            mock || example || '';

                    res.setHeader('content-type', 'application/json');
                    res.status(mockObj.defaultCode || 200).send(response);
                } else {
                    res.status(404).send();
                }
                this.log(colors.green(method + '\t' + uri));
            });
        });
    }
}

function done(){
    console.log('DONE!!!');
}

const mockServer = new RamlMockServer();
    var app = express();

    var options = {
        path: './spec/',
        debug: true,
        app: app,
        prefix: '',
        prioritizeBy: 'example'
    };

    app.listen(3000, () => {

        console.log(colors.blue('Listening on port 3000'));
    });
    mockServer.init(options, done);
