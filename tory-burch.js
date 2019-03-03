const download = require('download-file');
const puppeteer = require('puppeteer');
const url = 'https://www.toryburch.com/on/demandware.store/Sites-ToryBurch_US-Site/default/PrivateSale-Start';

(async () => {
    const browser = await puppeteer.launch({ headless: false });
    const page = await browser.newPage();
    await page.goto(url);

    const query = "body > \
        div.ui-dialog.ui-widget.ui-widget-content.ui-corner-all.ui-front.ui-fs-theme > \
        div.ui-dialog-titlebar.ui-widget-header.ui-corner-all.ui-helper-clearfix > \
        button > span.ui-button-text"

    // close signUp form
    await page.click(query);

    // login
    const email_field = "#dwfrm_emailsignup_email";
    const country_field = "#dwfrm_emailsignup_country";
    const login_submit = "#formdiv > div > div > form > fieldset > div > \
        div.actions > fieldset > button > span";

    await page.type(email_field, "hmm@gmail.com");
    await page.select(country_field, "US");
    page.click(login_submit);
    await page.waitForNavigation({ waitUntil: "networkidle0" });

    // go to bags page
    const bag_query = "ul.category_list > li:nth-child(7)"
    await Promise.all([
        page.waitForNavigation(),
        page.click(bag_query),
    ]);

    await scrollToBottom(page);
    const item_list = await scrapeElement(page);
    console.log(item_list);

    let download_options = {
        directory: "./tory-burch/"
    };

    for (let item of item_list) {
        download_options["filename"] = item.name + ".jpg";
        download(item.img_url, download_options, err => console.log(err));
    }

    await browser.close();
})();

async function scrapeElement(page) {
    const item_query = "div.grid-tile-container.js-grid-tile-container > \
        div.product-tile.product-list__item.js-product-tile.js-product-list-item";
    const item_list = await Promise.all([
            page.waitForSelector(item_query),
            page.$$eval(item_query, e => {
                let items = []
                for (let item of e ) {
                    console.log(item);
                    const img_url = item.querySelector(
                        ".product-tile__thumb-container > a > img").src;
                    const name = item.querySelector(
                        ".product-tile__info-container > a").innerHTML;
                    const original_price = item.querySelector(
                        ".product-tile__info-container > .pricing > \
                        .price--standard").innerHTML;
                    const discounted_price = item.querySelector(
                        ".product-tile__info-container > .pricing > \
                        .price--sale").innerHTML;
                    items.push({
                        name: name.trim(),
                        img_url: img_url,
                        original_price: original_price.trim(),
                        discounted_price: discounted_price.trim()
                    });
                }
                return items;
            })
        ])
        .then(value => value)
        .catch(err => err);
    return item_list[1];
}

async function countItems(page) {
    const item_query = "div.grid-tile-container.js-grid-tile-container > \
        div.product-tile.product-list__item.js-product-tile.js-product-list-item";
    const item_list = await Promise.all([
                        page.waitForSelector(item_query),
                        page.$$eval(item_query, e => e.length)
                    ])
                    .then(value => value)
                    .catch(err => err);
    return item_list[1];
}

async function scrollToBottom(page) {
    /**
     * HACKY CODE
     */
    const query = "span.body-copy.body-copy--s.filtersort__item-count"
    const total = await page.$eval(query, e => {
                return e.innerHTML;
            })
            .then(value => value)
            .catch(err => err);

    const total_items = parseInt(total.replace("items", "").trim());
    let current_items = 0;
    let current_height;

    while (current_items < total_items) {
        current_items = await countItems(page);
        // FIX: fix this line
        if (current_items == total_items) break;

        current_height = await page.evaluate("document.body.scrollHeight");
        await page.evaluate("window.scroll(0, document.body.scrollHeight)");
        // FIX: fix this line
        await page.waitForFunction(`document.body.scrollHeight > ${current_height}`);
        await page.waitFor(1000);
    }
}
