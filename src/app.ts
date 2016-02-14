import MainMenu from './menu/main_menu';
import * as fs from 'fs';

class App {
  
  start() {
    const mainMenu = new MainMenu();
    mainMenu.printWelcome();
  }
  
  openFile(fileName? : string) {
    if (!process.argv[2]) {
      fileName = 'game.bas';
    } else {
      fileName = process.argv[2];
    }
    
    fs.readFile(fileName, 'utf-8', function(err, data) {
      if (err) throw err;
      console.log('OK: ' + fileName);
      console.log(`Validating contents of ${fileName}...`);
    });
  }
  
  startREPL() {
    console.log('>>>');
  }
}

const app = new App();
app.start();
app.openFile();