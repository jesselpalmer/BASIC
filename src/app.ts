import { MainMenu } from './menu/main_menu';
import * as fs from 'fs';
import * as rl from 'readline';

class App {
  
  constructor() {
    this.start();
    this.openFile();
  }
  
  start() {
    const mainMenu = new MainMenu();
    mainMenu.printWelcome();
  }
  
  startREPL() {
    console.log('>>>');
  }
    
  openFile(fileName? : string) {
      if (!process.argv[2]) {
        fileName = 'game.bas';
      } else {
        fileName = process.argv[2];
      }
      
      fs.readFile(fileName, 'utf-8', function(err, data) {
        if (err) throw err;
        console.log(`OK: ${fileName}`);
        console.log(`Validating contents of ${fileName}...`);
        
        const rd = rl.createInterface({
          input: fs.createReadStream(fileName),
          output: process.stdout,
          terminal: false
        });

        rd.on('line', function(line) {
          console.log(`VALID: ${line}`);
        });
    });
  }
}

const app = new App();