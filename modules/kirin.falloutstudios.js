const Discord = require('discord.js');
const Kirin = require('./Kirin');

class KirinFalloutStudios {
    constructor() {
        this.versions = ['1.6.3', '1.6.4', '1.6.5', '1.6.6'];
        this.nativeVersion = '1.6.6';
        this.logger = null;
        this.kirin = null;
    }

    /**
     * 
     * @param {Discord.Client} Client
     * @returns {Boolean}
     */
    onStart(Client) {
        this.logger = Client.AxisUtility.logger;

        let minecraftProtocol = null;

        try {
            minecraftProtocol = require('minecraft-protocol');
        } catch (error) {
            this.logger.error('Please install "minecraft-protocol" using your package manager.', 'Kirin');
            this.logger.error(error, 'Kirin');
            return false;
        }

        this.kirin = new Kirin(Client, minecraftProtocol);

        return !!this.kirin;
    }

    /**
     * 
     * @param {Discord.Client} Client
     */
    async onLoad(Client) {
        if (Client.AxisUtility.config.version !== this.nativeVersion) {
            this.logger.warn(`Kirin is not running on version ${this.nativeVersion}! If errors occur, please update to the supported version.`, 'Kirin');
        }

        await this.kirin.parseServers();
        this.kirin.listenInteractions();

        this.logger.log(`Loaded ${this.kirin.servers.length} servers.`, 'Kirin');
        this.logger.log('Kirin loaded.', 'Kirin');
    }
}

module.exports = new KirinFalloutStudios();