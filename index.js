const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

require('dotenv').config();

const parentDir = path.join(__dirname, 'assessment_sample');

const imageExtensions = ['.jpg', '.jpeg', '.png'];

const prepareData = async () => {   // Prepare data based on sample data
    const productData = [];

    try {
        const childrenDirs = fs.readdirSync(parentDir);
        childrenDirs.forEach((childDir) => {

            const infoFile = path.join(parentDir, childDir, 'info.txt');
            const info = JSON.parse(fs.readFileSync(infoFile, 'utf8'));

            const fileNames = fs.readdirSync(path.join(parentDir, childDir));
            const images = fileNames.filter((fileName) => imageExtensions.includes(path.extname(fileName)));
            productData.push({
                info,
                images: images.slice(0, process.env.MAX_IMAGES_PER_PRODUCT).map((fileName) => path.join(parentDir, childDir, fileName)),
            });
        });

        return productData;
    } catch (error) {
        console.log(error);
    }
}

const login = async (page) => {
    try {
        // Go to login page
        await page.goto('https://auth.tnet.ge/en/select');
        const myDiv = await page.waitForSelector('div.myhome');
        await page.evaluate((div) => div.click(), myDiv);
        await page.click('input[id="myhome-for"]');
        await page.click('button.choseSite');
        
        // Enter email and password
        await page.goto('https://auth.tnet.ge/en/user/login/?Continue=https://www.myhome.ge/');
        await page.waitForSelector('input[name="Email"]');
        await page.type('input[name="Email"]', process.env.EMAIL);
        await page.type('input[name="Password"]', process.env.PASSWORD);
        await page.click('button.gradient-button');
        
    } catch (error) {
        await page.screenshot({ path: 'error_login.png' });
        console.log(error);
    }
}

const checkTransactionType = async (page, info) => {
    // Select Transaction type
    const transactionTypeIdx = parseInt(process.env.TRANSACTION_TYPE_INDEX) + 1;
    const transactionTypeSelector = `#addTypes div.radio-cards > div:nth-child(${transactionTypeIdx})`;
    const transactionType = await page.waitForSelector(transactionTypeSelector);
    await transactionType.click();
}

const checkConstructionStatus = async (page, info) => {
    // Select Contruction Status
    const constructionStatusIdx = parseInt(process.env.CONSTRUCTION_STATUS_INDEX) + 1;
    const constructionStatusSelector = `#estateTypes div.radio-cards > div:nth-child(${constructionStatusIdx})`;
    const constructionStatus = await page.waitForSelector(constructionStatusSelector);
    await constructionStatus.click();
}

const checkPaidService = async (page, info) => {
    const paidService = await page.waitForSelector(`#product-item-6 .promotions-container > div:nth-child(${info.paidService * 2}) input[type="checkbox"]`);
    await paidService.click();
}

const gotoAddProduct = async (page, product) => {
    return new Promise(async (resolve, reject) => {
        try {
            const { info, images } = product;
    
            // Add New Product
            await page.waitForSelector('.header-buttons-container');
            await page.click('.header-buttons-container a');
    
            // Click Draft Button
            await page.waitForTimeout(3000);
            const draftBtn = await page.$('.bottom button');
            if (draftBtn) {
                await page.waitForSelector('.bottom button');
                await page.click('.bottom button');
            }
        
            // Select flat type
            await page.waitForTimeout(2000);
            await page.waitForSelector('#product-item-1 div.statement_list #dropdownMenuButton');
            await page.click('#product-item-1 div.statement_list #dropdownMenuButton');
    
            const propertyTypeIdx = parseInt(process.env.PROPERTY_TYPE_INDEX) + 1;
            const propertyTypeSelector = `div.statement_list div.empty-container > div:nth-child(${propertyTypeIdx})`;
            const propertyType = await page.waitForSelector(propertyTypeSelector);
            await propertyType.click();
    
            // check transaction type
            await checkTransactionType(page, info);
            // if (info.transactionType) {
            // }
        
            // check construction status
            await checkConstructionStatus(page, info);
            // if (info.constructionStatus) {
            // }
        
            await page.waitForTimeout(1000);
            // Select Condition
            await page.waitForSelector('select[name="ConditionID"]');
            await page.select('select[name="ConditionID"]', process.env.CONDITION_INDEX);

            // Select Project
            await page.waitForSelector('select[name="ProjectID"]');
            await page.select('select[name="ProjectID"]', process.env.PROJECT_INDEX);

            const cookieBtn = await page.$('.cookie_wrap button');
            if (cookieBtn) {
                await page.waitForSelector('.cookie_wrap button');
                await page.click('.cookie_wrap button');
            }
        
            // Enter Address
            await page.waitForSelector('input[id="searchfield"]');
            await page.focus('input[id="searchfield"]');
            await page.type('input[id="searchfield"]', info.address);
        
            // Select First Option
            await page.waitForTimeout(2000);
            const firstOption = await page.waitForSelector('.suggestions div.list ul > li:first-child');
            await firstOption.click();
    
            // Add Google Map Marker
            if (process.env.GOOGLE_API_KEY) {
                await page.addScriptTag({
                    url: `http://maps.googleapis.com/maps/api/js?key=${process.env.GOOGLE_API_KEY}`,
                });
                await page.waitForFunction(() => typeof google !== 'undefined');
        
                const map = await page.waitForSelector('#productMap');
                const { lat, lng } = info.location;
                await page.evaluate(() => {
                    const center = new google.maps.LatLng(lat, lng);
                    new google.maps.Marker({
                        position: center,
                        map: map,
                        title: 'My Marker',
                    });
                }, { lat, lng });
            }
    
            // Enter Full Area
            await page.waitForSelector('input[name="AreaSize"]');
            await page.type('input[name="AreaSize"]', info.area.split(' ')[0]);
    
            // Enter Floors
            await page.waitForSelector('input[name="Floors"]');
            await page.type('input[name="Floors"]', info.totalFloors.toString());
    
            // Enter Floor
            await page.waitForSelector('input[name="Floor"]');
            await page.type('input[name="Floor"]', info.flatFloor.toString());
    
            // Select Rooms
            await page.waitForSelector('select[name="Rooms"]');
            await page.select('select[name="Rooms"]', info.rooms.toString());
    
            // Select Bedrooms
            await page.waitForSelector('select[name="BedRooms"]');
            await page.select('select[name="BedRooms"]', info.bedrooms.toString());
    
            // Enter Description
            await page.waitForSelector('textarea[name="CommentGeo"]');
            await page.type('textarea[name="CommentGeo"]', info.description);
    
            // Upload Images
            const fileInput = await page.$('input[type="file"][multiple]');
            await fileInput.uploadFile(...images);
            await page.waitForTimeout(5000);
    
            // Select Currency
            const currency = await page.waitForSelector('#product-item-4 .statement_list button');
            await currency.click();
            const currencyUSD = await page.waitForSelector('#product-item-4 div.statement_list .dropdown-menu > div:first-child');
            await currencyUSD.click();
    
            // Enter Price
            await page.waitForSelector('input[name="Price"]');
            await page.type('input[name="Price"]', info.priceUSD);

            // Enter Name
            await page.waitForSelector('input[name="ProductOwner"]');
            await page.type('input[name="ProductOwner"]', process.env.PRODUCT_OWNER);
    
            // Select Paid Service
            if (info.paidService) {
                await checkPaidService(page, info);
            }
    
            // Click Save button
            const saveBtn = await page.waitForSelector('.butt_wrap button.green');
            await saveBtn.click();
    
            // Select Payment Type
            await page.waitForTimeout(2000);
            const paymentIndex = parseInt(process.env.PAYMENT_TYPE) + 1;
            const payment = await page.waitForSelector(`.modal .main-payment div:nth-child(${paymentIndex})`);
            await payment.click();

            // Click Publish button
            await page.waitForTimeout(500);
            const publishBtn = await page.waitForSelector('.modal .buttons_bottom #paymentButton');
            await publishBtn.click();
    
            // Click OK button
            await page.waitForTimeout(1000);
            const okBtn = await page.waitForSelector('.modal .modal-footer button.btn-success');
            await okBtn.click();

            await page.waitForTimeout(3000);
            resolve();
    
        } catch (error) {
            await page.screenshot({ path: 'error_goto_add_product.png' });
            console.log(error);
            reject(error);
        }

    });
}

const run = async () => {
    const fileData = await prepareData();

    const browser = await puppeteer.launch({ headless: false });
    const page = await browser.newPage();

    await login(page);
    for (item of fileData) {
        await gotoAddProduct(page, item);
    }

    await browser.close();
}

run();
