const { SafeMessage } = require('../../../scripts/safeActions');
const { MessageEmbed } = require('discord.js');
const os = require('systeminformation');
const Kirin = require('../');

module.exports = class SystemInfo {
    /**
     * 
     * @param {Kirin} kirin 
     */
    constructor(kirin) {
        this.kirin = kirin;
        this.logger = kirin.logger;
        this.guildId = kirin.config.systemstatus.guildId;
        this.channelId = kirin.config.systemstatus.channelId;
        this.messageId = kirin.config.systemstatus.messageId;
        this.message = null;
        this.memory = {};
        this.battery = {};
    }

    async getMessage() {
        const guild = this.kirin.Client.guilds.cache.get(this.guildId) || await this.kirin.Client.guilds.fetch(this.guildId);
        const channel = guild ? (guild.channels.cache.get(this.channelId) || await guild.channels.fetch(this.channelId)) : null;
        const message = channel ? (channel.messages.cache.get(this.messageId) || await channel.messages.fetch(this.messageId)) : null;

        this.message = message;
        return this;
    }

    async getInfo() {
        this.memory = await os.mem();
        this.battery = await os.battery();
        if (this.kirin.config.systemstatus.enabled) {
            await this.update();

            setTimeout(async () => this.getInfo(), this.kirin.config.systemstatus.updateInterval);
        }
    }

    async update() {
        if (!this.message) return;

        await SafeMessage.edit(this.message, { content: ' ', embeds: [this.getEmbed()], components: [] });
    }

    getEmbed() {
        const embed = new MessageEmbed()
            .setColor(this.kirin.Client.AxisUtility.config.embedColor)
            .setTitle(this.kirin.config.messages.systemstatus.title)
            .setFooter({ text: 'Last Updated' }).setTimestamp();

        if (this.memory) {
            if (this.kirin.config.systemstatus.memory.showUsedMemory) embed.addField(this.kirin.config.messages.systemstatus.status.usedMemory, `${this.bytesToGigabytes(this.memory.used)} GB`);
            if (this.kirin.config.systemstatus.memory.showFreeMemory) embed.addField(this.kirin.config.messages.systemstatus.status.freeMomery, `${this.bytesToGigabytes(this.memory.total - this.memory.used)} GB`);
            if (this.kirin.config.systemstatus.memory.showTotalMemory) embed.addField(this.kirin.config.messages.systemstatus.status.totalMemory, `${this.bytesToGigabytes(this.memory.total)} GB`);
        } else {
            if (this.kirin.config.systemstatus.showUnavailableInfo) embed.addField(this.kirin.config.messages.systemstatus.unavailable.memory.title, this.kirin.config.messages.systemstatus.unavailable.memory.description);
        }

        if (this.battery?.hasBattery) {
            if (this.kirin.config.systemstatus.battery.showBatteryLevel) embed.addField(this.kirin.config.messages.systemstatus.status.batteryLevel, `${this.battery.percent}%`);
            if (this.kirin.config.systemstatus.battery.showBatteryStatus) embed.addField(this.kirin.config.messages.systemstatus.status.batteryStatus.title, this.battery.isCharging ? this.kirin.config.messages.systemstatus.status.batteryStatus.charging : this.kirin.config.messages.systemstatus.status.batteryStatus.notCharging);
        } else {
            if (this.kirin.config.systemstatus.showUnavailableInfo) embed.addField(this.kirin.config.messages.systemstatus.unavailable.battery.title, this.kirin.config.messages.systemstatus.unavailable.battery.description);
        }

        return embed;
    }

    bytesToGigabytes(bytes) {
        let gigabytes = bytes / 1024 / 1024 / 1024;

        gigabytes = gigabytes.toFixed(2);

        return gigabytes >= 0 ? gigabytes : 0;
    }
}