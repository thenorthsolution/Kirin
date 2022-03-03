# Module template

```js
// Require command builders if this is a command module
const { InteractionCommandBuilder, MessageCommandBuilder } = require('../scripts/builders');


// Builder
class Create {
    constructor() {
        this.versions = ['1.6.5'];  // Specify the versions that this command is compatible with
        this.commands = [
            // Creating a message command
            new MessageCommandBuilder()
                .setName('test')                                                            // Set the name of the command
                .setDescription('Test command')                                             // Command description is optional for help command
                .addArgument('arg', false, 'test argument', ['val1', 'val2'])               // Command argument is optional for help command
                .setExecute((args, message, Client) => message.reply('Test command')),      // This is the function to execute when the command is called

            // Creating an interaction command
            new InteractionCommandBuilder()
                .setCommand(SlashCommandBuilder => SlashCommandBuilder
                    .setName('test')                                                        // Set command name
                    .setDescription('Test command')                                         // Set command description
                    .addStringOption(option => option
                        .setName('arg')                                                     // Set option name
                        .setDescription('test argument')                                    // Set option description
                        .setRequired(false)                                                 // Set if the option is required
                    )                                                                       // Add string argument
                )                                                                           // Use discord SlashCommandBuilder
                .setExecute((interaction, Client) => interaction.reply('Test command'))     // This is the function to execute when the command is called
        ];                                                                                  // List of commands
    }

    // This will be executed when loading the module
    // Return true if the module is loaded
    onStart(Client) { return true; }

    // This will be executed when the module is loaded
    onLoad(Client) {
        console.log(`Loaded test module with Axis v${Client.AxisUtility.config.version}`);
    }
}


// Export the module
module.exports = new Create();
```
