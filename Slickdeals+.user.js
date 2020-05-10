// ==UserScript==
// @name        Slickdeals+
// @namespace   V@no
// @description Various enhancements
// @include     https://slickdeals.net/*
// @version     1.5.1
// @run-at      document-start
// @grant       none
// ==/UserScript==

let log = console.log.bind(console),
		linksData = {},
		observer = new MutationObserver(function(mutations, observer)
		{
//		log("--------", mutations);
			for (let i = 0; i < mutations.length; i++)
			{
				for (let n = 0; n < mutations[i].addedNodes.length; n++)
				{
					getData(mutations[i].addedNodes[n]);
					fixLink(mutations[i].addedNodes[n]);
				}
			}
		});


function $$(id, node, all)
{
	try
	{
		if (!node)
			node = document;

		if (!all && id.match(/^[a-zA-Z0-9]/))
			return node.getElementById(id);

		if (all)
			return node.querySelectorAll(id);

		return node.querySelector(id);
	}
	catch(e)
	{
		return undefined;
	}
}

function trim(t)
{
	if (!t)
		return ""+t;

	return (""+t).trim();
}

function findParent(node, attr)
{
	attr = attr || {tagName: "LI"};
	if (!node)
		return node;


	let found = true;
	for(let i in attr)
	{
		if (i == "classList")
		{
			for(let c = 0; c < attr[i].length; c++)
			{
				if (!node.classList.contains(attr[i][c]))
				{
					found = false;
					break;
				}
			}
		}
		else if (typeof(attr[i]) == "object")
		{
			for(let a in attr[i])
			{
				if (node[i][a] != attr[i][a])
				{
					found = false;
					break;
				}
			}
		}
		else
		{
			found = node[i] == attr[i];
		}
		if (!found)
		{
			break;
		}
	}
	if (found)
		return node;

	return findParent(node.parentNode, attr);
}

function multiline(func, ws)
{
	func = func.toString();
	func = func.slice(func.indexOf("/*") + 2, func.lastIndexOf("*/")).split("*//*").join("*/");
	return ws ? func : func.replace(/[\n\t]*/g, "");
}

function getData(node)
{
	let items = $$(".salePrice,.itemPrice,.price", node, true) || [],
			r = [];

	for (let i = 0; i < items.length; i++)
	{
		let itemPrice = items[i],
				parent = itemPrice.parentNode,
				price = trim(itemPrice.innerText),
				priceFree = price && price.match(/or free/i),
				priceNew = price ? ((price.toLowerCase() == "free") ? 0 : (price.match(/^\$/) ? parseFloat(price.replace(/[^0-9.]/g, "")) : NaN)) : NaN,
				priceRetail = parseFloat(trim(($$(".retailPrice", parent) || {}).innerText).replace(/^\$([0-9.]+)/g, "$1")),
				priceOld = parseFloat(trim(($$(".oldListPrice", parent) || {}).innerText).replace(/^\$([0-9.]+)/g, "$1")),
				item = findParent(parent)
							|| findParent(parent, {tagName: "DIV", dataset: {type: "fpdeal"}})
							|| findParent(parent, {tagName: "DIV", classList: ["resultRow"]})
							|| findParent(parent, {tagName: "DIV", dataset: {role: "frontpageDealContent"}});

		item && item.classList.toggle("free", (priceNew === 0 || priceFree) ? true : false);

		r[r.length] = {
			item: item,
			price: price,
			priceNew : priceNew,
			priceRetail: priceRetail,
			priceOld: priceOld
		};

//log(price, priceNew, priceRetail, priceOld, itemPrice, item);
	}
	return r;
}

function fixLink(node)
{
	let links = $$("a", node, true);
	if (!links)
		return;

	for(let i = 0; i < links.length; i++)
	{
		let a = links[i];
		if ("_href" in a)
			continue;

		a._href = a.href;
		let m = a.href.match(/(\?|&)(pno=([^&]+))/i);
		if (m)
		{
//			a.href = a.href.replace(/\?.*/i, "?" + m[2]);
			if (!a._resolved)
			{
				a.classList.toggle("primary", true);
				a.classList.toggle("success", false);
			}
			if (!linksData[m[3]])
			{
				linksData[m[3]] = [a];
				let iframe = document.createElement("iframe");
				iframe.id = "iframe" + m[3];
				iframe.src = "https://unplumb-waves.000webhostapp.com/slickdeals/?" + m[3] + "&r=" + location.protocol + "//" + location.host;
				iframe.style.display = "none";
				document.body.appendChild(iframe);
			}
			if (linksData[m[3]].indexOf(a) == -1)
				linksData[m[3]][linksData[m[3]].length] = a;
		}
	}
}

function receiveMessage(e)
{
	if (["https://unplumb-waves.000webhostapp.com", "https://sLickdeals.net"].indexOf(e.origin) == -1)
		return;

	let a,data = JSON.parse(e.data);
	if (!data || !(a = linksData[data.id]))
		return;

	let iframe = $$("iframe" + data.id);
	iframe.parentNode.removeChild(iframe);

	for(let i = 0; i < a.length; i++)
	{
		a[i]._resolved = true;
		a[i].href = data.url;
		a[i].classList.toggle("success", true);
		a[i].classList.toggle("primary", false);
	}
}

function main()
{
	window.removeEventListener('DOMContentLoaded', main, false);
	observer.observe(document, {
		subtree: true,
		childList: true
	});
	getData(document);
	fixLink(document);
	let css = document.createElement("style");
	css.innerHTML = multiline(function(){/*
div.free,
li.free
{
	box-shadow: 0 0 10px red;
}
div.free,
#fpMainContent .gridCategory .fpGridBox.list.free,
#fpMainContent .gridCategory .fpGridBox.simple.free
{
	margin: 5px;
}
*/});
	document.getElementsByTagName("head")[0].appendChild(css);
}

window.addEventListener("message", receiveMessage, false);
window.addEventListener('DOMContentLoaded', main, false);

if (window.document.readyState == "complete")
	main();
