import { Config } from '@remotion/cli/config';
// usa o Chrome instalado (não baixa outro navegador)
Config.setBrowserExecutable(process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe');
Config.setVideoImageFormat('jpeg');
Config.setJpegQuality(92);
Config.setConcurrency(2);
