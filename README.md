# Kirin

Start your servers via Discord using Kirin

## Installation (Pre-made Bot)
Download file `KirinBot.zip` for pre-made bot from [Latest Release](https://github.com/FalloutStudios/Axis/releases/latest) and extract the contents into a folder. After extracting, run the following command to install dependencies once only:

```bash
npm install
```

To run your bot:
```bash
node index.js
```

> We expect you to have your own Discord bot token. If you don't, you can get one from [Discord Bot List](https://discord.com/developers/applications/). Put your bot token in `config/Bot/config.yml` after first run.

## Installation (Axis module)

Download the file `Source Code.zip` from [Latest Release](https://github.com/FalloutStudios/Kirin/releases/latest) then extract the file.

After extractions click the first folder then copy `modules` folder to the root of your [Axis Bot](https://github.com/FalloutStudios/Axis) or `modules` contents if you're not using default modules folder.

## Installation (Axis module utility)

To easily install [Axis](https://github.com/FalloutStudios/Axis) modules you can use the [Axis module utility](https://github.com/GhexterCortes/axis-module-utility) using npm just by running:

> Install it globally

```bash
npm i -g axis-module-utility
```

After successful installation you can use the utility to install the module. Download the file `KirinModule.zip` from [Latest Release](https://github.com/FalloutStudios/Axis/releases/latest) DONT EXTRACT THE CONTENTS. Using the utility you can install the module by running:

> First: Open your terminal and locate your Axi bot's folder using `cd <path>` command and put the `KirinModule.zip` file in the same folder.

```bash
axis i ./KirinModule.zip
```

to uninstall the module

```bash
axis un kirin
```