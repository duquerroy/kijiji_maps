var express = require('express');
var fs = require('fs');
var request = require('request');
var cheerio = require('cheerio');
var app     = express();

var bodyParser = require('body-parser');
var urlencodedParser = bodyParser.urlencoded({ extended: false });


var url        = "";
var url_next   = "";
var urls       = [];
var sites      = [];
var address    = [];
var index_site = -1;
var counter = 0;

//MogoDB
var monk = require('monk');
var MongoClient = require('mongodb').MongoClient
    , format = require('util').format;
var db = monk('localhost:27017/nodetest1');


var beaches = [];

// Make our db accessible to our router
app.use(function(req,res,next){
    req.db = db;
    next();
});


var test_next = function(req, res, next){
	index_site = index_site + 1;
	if (undefined !== sites[index_site]) {
		url_page = 'http://www.kijiji.ca'+sites[index_site];

		var db = req.db;
		var collection = db.get('usercollection');
	    collection.find({'url': url_page},{},function(e,docs){
	    	if (undefined != docs && Object.keys(docs).length == 0){

				request(url_page, function(error, response, html1){
					console.log('search page');
					console.log('url_page =>', response.request.uri.href);
					if(!error){
						var $ = cheerio.load(html1, {
							normalizeWhitespace: true,
						});
						var ad = $('.ad-attributes > tr:nth-child(3) > td:nth-child(2)').text();
						// console.log('ad =>',ad);
						var url_page1 = response.request.uri.href;
						var price     = $('[itemprop="price"]').text();
						var title_ad  = $('h1').text();
						var latitude  = $('meta[property="og:latitude"]').attr('content')*1;
						var longitude = $('meta[property="og:longitude"]').attr('content')*1;
						title_ad      = title_ad.replace(/\"/g,'');
						title_ad      = title_ad.replace(/\\/g,'');
						price         = price.replace(/\"/g,'');
						ad            = ad.replace(/\"/g,'');
						// console.log('AD =>', ad);
						if (ad.length>5){
							ad = '{"address":"'+ad.replace('Afficher la carte','')+'","price":"'+price+'","url":"'+url_page1+'","title_ad":"'+title_ad+'","latitude":'+latitude+',"longitude":'+longitude+'}';
							ad = ad.replace(/(\r\n|\n|\r)/gm,"");
							ad = ad.replace(/    /g,'');
						} else {
							ad = "";
						}
						console.log('json ===>',ad);
						if ("" !== ad){
							address[index_site] = ad;
							ad = JSON.parse(ad);
					    	
									beaches.push([ad.address, ad.price, ad.latitude, ad.longitude, ad.url, ad.title_ad]);

									// Submit to the DB
									console.log('Insert dans la bdd...');
								    collection.insert({
										'address': ad.address,
										'price': ad.price,
										'lat': ad.latitude,
										'lon': ad.longitude,
										'url':ad.url,
										'title_ad':ad.title_ad
								    }, function (err, doc) {
								        if (err) {
								            // If it failed, return error
								            console.log("There was a problem adding the information to the database.");
								        }
								    });
						}
					}
				});

	    	} else {
		    	console.log('Prends dans la bdd...');
		    	beaches.push([docs[0].address, docs[0].price, docs[0].lat, docs[0].lon, docs[0].url, docs[0].title_ad]);
	    	}
	    }).then(function(){
				test_next(req, res, next);
			});
	} else {
		var info = '{"info":['+address+']}';
		req.body.url = url;
		first_page(req, res, next);
	}
	next();
};


app.get('/maps', function(req, res, next){

	res.render("index.ejs", {layout: false, lat:46.8357689, lon:-71.220735, zoom:12, beaches:JSON.stringify(beaches)});
	next();
});

// app.use(test_next);

app.post('/add', urlencodedParser, function(req, res, next) {
	counter = 0;
	first_page(req, res, next);
	console.log('beaches =>', beaches);
	res.render("index.ejs", { layout: false, lat:46.8357689, lon:-71.220735, zoom:12, beaches:JSON.stringify(beaches)});

});

app.post('/refresh', function(req, res, next) {
	// first_page(req, res, next);
		res.render("index.ejs", { layout: false, lat:46.8357689, lon:-71.220735, zoom:12, beaches:JSON.stringify(beaches)});
});

var first_page = function(req, res, next){
	console.log('req.body.url ======>', req.body.url);
	if (req.body.url != '') {
		url = req.body.url;
		index_site = -1;
		sites = [];
		urls = [];
		++counter;
		console.log('counter =>', counter);
		if (10 > counter){
		// url = 'http://www.kijiji.ca/b-appartement-condo/ville-de-quebec/c37l1700124r2.0?ad=offering';
			if (url !== ""){
				request(url, function(error, response, html){
					if(!error){
						console.log('URL ===>', url);
						var $ = cheerio.load(html);
						// $('.container-results').filter(function(){
						urls = [].map.call($('a.title'), function(link) {
							return link;
						});
						url_next = $(".pagination > a[title='Suivante']").attr('href');
						url = " http://www.kijiji.ca"+url_next;
						console.log('url_next ===>', url);
						Object.keys(urls).forEach(function(trait) {
							sites.push(urls[trait].attribs.href);
						});
						req.sites = sites;
					}
				test_next(req, res, next);
				});
			}
		}
	}
};

app.listen('8081');
console.log('Magic happens on port 8081');
exports = module.exports = app;
