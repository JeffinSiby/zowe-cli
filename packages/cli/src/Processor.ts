/*
* This program and the accompanying materials are made available under the terms of the
* Eclipse Public License v2.0 which accompanies this distribution, and is available at
* https://www.eclipse.org/legal/epl-v20.html
*
* SPDX-License-Identifier: EPL-2.0
*
* Copyright Contributors to the Zowe Project.
*
*/

import { Imperative } from "@zowe/imperative";
import { homedir } from "os";
import { join } from "path";
import * as net from "net";
import { DaemonClient } from "./DaemonClient";

// TODO(Kelosky): handle prompting cases from login command
// TODO(Kelosky): prompt* broken - hangs, must restart daemon
// TODO(Kelosky): colors do not come through on some terminals (must be started via `node lib/main --daemon` to see colors)
// TODO(Kelosky): stderr
// TODO(Kelosky): plugins install

/**
 * Initial paramter parse to handle conditionally starting as a persistent process (e.g. daemon mode)
 * @export
 * @class Processor
 */
export class Processor {

    /**
     * Default port number
     * @private
     * @static
     * @memberof Processor
     */
    private static readonly DEFAULT_PORT = 4000;

    /**
     * Undocumented paramter for launching in server mode
     * @private
     * @static
     * @memberof Processor
     */
    private static readonly DAEMON_KEY = "--daemon";

    /**
     * Hold instance of a running server
     * @private
     * @type {net.Server}
     * @memberof Processor
     */
    private mServer: net.Server;

    /**
     * Hold current socket path for the server
     * @private
     * @type {number}
     * @memberof Processor
     */
    private mSocket: string;

    /**
     * Indicator for whether or not to start the server
     * @private
     * @type {boolean}
     * @memberof Processor
     */
    private mStartServer: boolean;

    /**
     * Creates an instance of Processor.
     * @param {string[]} mParms
     * @memberof Processor
     */
    constructor(private mParms: string[]) { }

    /**
     * Initialize our processor parse and optionally start the server
     * @memberof Processor
     */
    public init() {

        this.initialParse();
        if (this.startServer) {

            this.mServer = net.createServer((c) => {
                new DaemonClient(c, this.mServer).run();
            });

            this.mServer.on('error', this.error.bind(this));
            this.mServer.on('close', this.close.bind(this));
        }
    }

    /**
     * Method to immediately parse or otherwise start the server for later processing from
     * incoming socket connections.
     * @memberof Processor
     */
    public process() {
        if (this.mServer) {
            this.mServer.listen(this.mSocket, () => {
                Imperative.api.appLogger.debug(`daemon server bound ${this.mSocket}`);
                Imperative.console.info(`server bound ${this.mSocket}`);
            });
        } else {
            Imperative.parse();
        }
    }

    /**
     * Server close handler
     * @private
     * @memberof Processor
     */
    private close() {
        Imperative.api.appLogger.debug(`server closed`);
    }

    /**
     * Server error handler
     * @private
     * @param {Error} err
     * @memberof Processor
     */
    private error(err: Error) {
        Imperative.api.appLogger.error(`daemon server error: ${err.message}`);
        throw err;
    }

    /**
     * Perform initial parsing of undocumented parameters
     * @private
     * @memberof Processor
     */
    private initialParse() {
        const numOfParms = this.mParms.length - 2;
        const sockName = "zowe-daemon.sock";
        this.mSocket = join(homedir(), sockName);

        if (numOfParms > 0) {
            const parm = this.mParms[2];

            /**
             * NOTE(Kelosky): For now, we use an undocumented paramter `--daemon`.  If found first,
             * we bypass `yargs` and begin running this as a persistent Processor.
             */
            const portOffset = parm.indexOf(Processor.DAEMON_KEY);

            if (portOffset > -1) {
                this.startServer = true;
                if (process.env.ZOWE_DAEMON_DIR) {
                    try {
                        this.mSocket = join(process.env.ZOWE_DAEMON_DIR, sockName);
                    } catch (err) {
                        // do nothing
                    }
                }
                Imperative.api.appLogger.debug(`daemon server socket ${this.mSocket}`);
            }
        }
    }

    /**
     * Get whether or not to start the server
     * @private
     * @memberof Processor
     */
    private get startServer() {
        return this.mStartServer;
    }

    /**
     * Set whether or not to start the server
     * @private
     * @memberof Processor
     */
    private set startServer(startServer) {
        this.mStartServer = startServer;
    }
}

