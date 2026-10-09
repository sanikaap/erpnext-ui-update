"""
Stock demo data for the Modern ERP UI dashboards.

Creates a small, realistic inventory history (Apr–Oct 2026) through ERPNext's normal
document lifecycle: masters first, then purchases (PO → Purchase Receipt → Purchase
Invoice), stock movements (Stock Entry), sales (SO → Delivery Note → Sales Invoice)
and Material Requests. Stock balances, the Stock Ledger and GL entries are produced by
ERPNext itself when documents are submitted; nothing is written to those tables here.

Every record this module creates gets the Frappe tag "Sample Data". Existing records are
reused, never modified. Running `seed` again finds the tagged records by their natural
keys (party + date + type) and creates nothing twice.

    bench --site erp.localhost execute modern_erp_ui.sample_data.stock_demo.seed --kwargs "{'dry_run': 1}"
    bench --site erp.localhost execute modern_erp_ui.sample_data.stock_demo.seed
    bench --site erp.localhost execute modern_erp_ui.sample_data.stock_demo.verify
    # Removes only tagged sample records (never run automatically):
    bench --site erp.localhost execute modern_erp_ui.sample_data.stock_demo.cleanup --kwargs "{'confirm': 'yes'}"
"""

import frappe
from frappe.desk.doctype.tag.tag import DocTags
from frappe.utils import add_days, flt

TAG = "Sample Data"
DRY = "(dry run)"
COMPANY = "Tesla"
STORES = "Stores - T"
FINISHED = "Finished Goods - T"
WIP = "Work In Progress - T"
BUYING_LIST = "Standard Buying"
SELLING_LIST = "Standard Selling"

# ---------------------------------------------------------------- masters

BRANDS = ["Logiq", "Voltix", "Northfield"]

# code, name, group, brand, buying rate, selling rate (None = not sold)
ITEMS = [
	("SKU-1001", "Wireless Mouse", "Products", "Logiq", 450, 799),
	("SKU-1002", "Mechanical Keyboard", "Products", "Logiq", 2200, 3499),
	("SKU-1003", '27" IPS Monitor', "Products", "Northfield", 14500, 19999),
	("SKU-1004", "USB-C Docking Station", "Products", "Voltix", 6800, 9499),
	("SKU-1005", "Noise-Cancelling Headset", "Products", "Logiq", 3900, 5999),
	("SKU-1006", "Aluminium Laptop Stand", "Products", "Northfield", 900, 1599),
	("SKU-2001", "Motherboard Assembly", "Sub Assemblies", "Voltix", 8200, None),
	("SKU-2002", "Power Supply Unit 650W", "Sub Assemblies", "Voltix", 3100, None),
	("SKU-3001", "Aluminium Chassis Panel", "Raw Material", None, 1250, None),
	("SKU-3002", "Copper Wire Spool 100m", "Raw Material", None, 2400, None),
	("SKU-3003", "Thermal Paste 5g", "Raw Material", None, 180, None),
	("SKU-4001", "Packing Carton (Medium)", "Consumable", None, 35, None),
	("SKU-4002", "Anti-static Bags (Pack of 100)", "Consumable", None, 650, None),
	("SKU-4003", "Cable Ties (Pack of 500)", "Consumable", None, 420, None),
]
RATE = {code: buy for code, _n, _g, _b, buy, _s in ITEMS}
PRICE = {code: sell for code, _n, _g, _b, _buy, sell in ITEMS}

# item, warehouse, reorder level, reorder qty, material request type
REORDER = [
	("SKU-3003", STORES, 25, 100, "Purchase"),
	("SKU-4003", STORES, 10, 20, "Purchase"),
	("SKU-4002", STORES, 10, 20, "Purchase"),
	("SKU-3002", STORES, 35, 15, "Purchase"),
	("SKU-1005", FINISHED, 5, 6, "Transfer"),
	("SKU-1004", FINISHED, 5, 5, "Transfer"),
]

CUSTOMERS = ["Northwind Retail", "Bluefin Traders"]

# ---------------------------------------------------------------- transactions (chronological)
# Each event: (kind, date, spec). Sales and purchases reference earlier events by `ref`.

EVENTS = [
	("stock_entry", "2026-04-03", {"type": "Material Receipt", "note": "Opening stock", "to": STORES, "items": [
		("SKU-1001", 120), ("SKU-1002", 60), ("SKU-1003", 25), ("SKU-1004", 20), ("SKU-1005", 30), ("SKU-1006", 50),
		("SKU-2001", 15), ("SKU-2002", 20), ("SKU-3001", 80), ("SKU-3002", 25), ("SKU-3003", 60),
		("SKU-4001", 600), ("SKU-4002", 30), ("SKU-4003", 25)]}),
	("stock_entry", "2026-04-10", {"type": "Material Transfer", "note": "Stock finished goods floor", "from": STORES, "to": FINISHED, "items": [
		("SKU-1001", 60), ("SKU-1002", 30), ("SKU-1003", 12), ("SKU-1004", 10), ("SKU-1005", 15), ("SKU-1006", 25)]}),
	("sales_order", "2026-04-20", {"ref": "so1", "customer": "Tech Solutions", "items": [("SKU-1001", 30), ("SKU-1002", 15)]}),
	("delivery_note", "2026-04-24", {"ref": "dn1", "from": "so1"}),
	("sales_invoice", "2026-04-25", {"from": "dn1"}),
	("purchase_order", "2026-05-04", {"ref": "po1", "supplier": "Tech Supplies", "items": [("SKU-1003", 15, 14200), ("SKU-1004", 10, 6700)]}),
	("purchase_receipt", "2026-05-12", {"ref": "pr1", "from": "po1"}),
	("purchase_invoice", "2026-05-14", {"from": "pr1"}),
	("stock_entry", "2026-05-15", {"type": "Material Transfer", "note": "Replenish display stock", "from": STORES, "to": FINISHED, "items": [("SKU-1003", 12), ("SKU-1004", 8)]}),
	("sales_order", "2026-05-18", {"ref": "so2", "customer": "Northwind Retail", "items": [("SKU-1003", 10), ("SKU-1004", 6)]}),
	("delivery_note", "2026-05-22", {"ref": "dn2", "from": "so2"}),
	("sales_invoice", "2026-05-23", {"from": "dn2"}),
	("stock_entry", "2026-05-29", {"type": "Material Issue", "note": "Packing consumables used", "from": STORES, "items": [("SKU-4001", 220), ("SKU-4002", 8), ("SKU-4003", 6)]}),
	("purchase_order", "2026-06-08", {"ref": "po2", "supplier": "Demo Supplier", "items": [("SKU-1001", 100, 440), ("SKU-1002", 40, 2150), ("SKU-1005", 20, 3850)]}),
	("purchase_receipt", "2026-06-15", {"ref": "pr2", "from": "po2"}),
	("stock_entry", "2026-06-16", {"type": "Material Transfer", "note": "Replenish display stock", "from": STORES, "to": FINISHED, "items": [("SKU-1001", 80), ("SKU-1002", 30), ("SKU-1005", 15)]}),
	("purchase_invoice", "2026-06-18", {"from": "pr2"}),
	("sales_order", "2026-06-22", {"ref": "so3", "customer": "Demo Customer", "items": [("SKU-1001", 50), ("SKU-1005", 18), ("SKU-1006", 12)]}),
	("delivery_note", "2026-06-26", {"ref": "dn3", "from": "so3"}),
	("sales_invoice", "2026-06-27", {"from": "dn3"}),
	("purchase_receipt", "2026-07-06", {"ref": "pr3", "supplier": "Marco", "items": [("SKU-3001", 60, 1270), ("SKU-3002", 20, 2450), ("SKU-4001", 500, 36)]}),
	("purchase_invoice", "2026-07-09", {"from": "pr3"}),
	("stock_entry", "2026-07-10", {"type": "Material Transfer", "note": "Raw material to assembly", "from": STORES, "to": WIP, "items": [("SKU-3001", 50), ("SKU-3002", 15)]}),
	("sales_order", "2026-07-20", {"ref": "so4", "customer": "Bluefin Traders", "items": [("SKU-1002", 25), ("SKU-1003", 6)]}),
	("delivery_note", "2026-07-24", {"ref": "dn4", "from": "so4"}),
	("sales_invoice", "2026-07-25", {"from": "dn4"}),
	("stock_entry", "2026-07-28", {"type": "Material Issue", "note": "Consumed in assembly", "from": WIP, "items": [("SKU-3001", 40), ("SKU-3002", 12)]}),
	("purchase_order", "2026-08-03", {"ref": "po3", "supplier": "Tech Supplies", "items": [("SKU-2001", 12, 8100), ("SKU-2002", 15, 3050)]}),
	("purchase_receipt", "2026-08-11", {"ref": "pr4", "from": "po3"}),
	("stock_entry", "2026-08-12", {"type": "Material Transfer", "note": "Sub-assemblies to assembly", "from": STORES, "to": WIP, "items": [("SKU-2001", 10), ("SKU-2002", 12)]}),
	("sales_order", "2026-08-17", {"ref": "so5", "customer": "Tech Solutions", "items": [("SKU-1004", 8), ("SKU-1006", 10), ("SKU-1001", 30)]}),
	("stock_entry", "2026-08-20", {"type": "Material Issue", "note": "Packing consumables used", "from": STORES, "items": [("SKU-4001", 300), ("SKU-4002", 10), ("SKU-4003", 8), ("SKU-3003", 30)]}),
	("delivery_note", "2026-08-21", {"ref": "dn5", "from": "so5"}),
	("sales_invoice", "2026-08-22", {"from": "dn5"}),
	("stock_entry", "2026-08-26", {"type": "Material Issue", "note": "Consumed in assembly", "from": WIP, "items": [("SKU-2001", 8), ("SKU-2002", 10)]}),
	("purchase_order", "2026-09-14", {"ref": "po4", "supplier": "Demo Supplier", "items": [("SKU-1003", 10, 14300), ("SKU-1006", 40, 880)]}),
	("sales_order", "2026-09-21", {"ref": "so6", "customer": "Northwind Retail", "items": [("SKU-1003", 8), ("SKU-1005", 10)]}),
	# Partial receipt: 25 of 40 laptop stands arrive.
	("purchase_receipt", "2026-09-22", {"ref": "pr5", "from": "po4", "qty": {"SKU-1006": 25}}),
	("stock_entry", "2026-09-23", {"type": "Material Transfer", "note": "Replenish display stock", "from": STORES, "to": FINISHED, "items": [("SKU-1003", 8), ("SKU-1006", 20)]}),
	("delivery_note", "2026-09-28", {"ref": "dn6", "from": "so6"}),
	("material_request", "2026-09-28", {"type": "Purchase", "warehouse": STORES, "items": [("SKU-3003", 100), ("SKU-4002", 20), ("SKU-4003", 20)]}),
	("stock_entry", "2026-09-30", {"type": "Material Issue", "note": "Packing consumables used", "from": STORES, "items": [("SKU-4001", 180), ("SKU-3003", 18), ("SKU-4003", 6)]}),
	("purchase_order", "2026-10-05", {"ref": "po5", "supplier": "Tech Supplies", "items": [("SKU-1004", 12, 6750), ("SKU-1005", 15, 3900)]}),
	("sales_order", "2026-10-06", {"ref": "so7", "customer": "Demo Customer", "items": [("SKU-1002", 10), ("SKU-1001", 20)]}),
	("material_request", "2026-10-07", {"type": "Purchase", "warehouse": STORES, "items": [("SKU-3002", 15)]}),
	("material_request", "2026-10-07", {"type": "Material Transfer", "warehouse": FINISHED, "from": STORES, "items": [("SKU-1005", 6), ("SKU-1004", 5)]}),
	# Left as drafts on purpose: the dashboard's "pending stock entries".
	("stock_entry", "2026-10-07", {"type": "Material Transfer", "note": "Dock restock (awaiting approval)", "from": STORES, "to": FINISHED, "items": [("SKU-1004", 5)], "draft": True}),
	("stock_entry", "2026-10-08", {"type": "Material Issue", "note": "Cartons for dispatch (awaiting approval)", "from": STORES, "items": [("SKU-4001", 50)], "draft": True}),
]


# ---------------------------------------------------------------- helpers

class Run:
	def __init__(self, dry_run):
		self.dry_run = dry_run
		self.refs = {}
		self.created, self.reused, self.failed = [], [], []

	def log(self, bucket, doctype, name, detail=""):
		getattr(self, bucket).append((doctype, name, detail))
		print(f"  [{bucket[:-1] if bucket != 'reused' else 'reuse'}] {doctype} {name} {detail}".rstrip())


def tagged(doctype, filters):
	"""Sample records of `doctype` matching `filters` (cancelled ones are ignored)."""
	return frappe.get_all(doctype, filters={**filters, "_user_tags": ["like", f"%{TAG}%"], "docstatus": ["!=", 2]}, pluck="name", order_by="creation")


def tag(doctype, name):
	DocTags(doctype).add(name, TAG)


def posting(doc, date, sequence):
	doc.set_posting_time = 1
	doc.posting_date = date
	doc.posting_time = f"{9 + sequence // 60:02d}:{sequence % 60:02d}:00"


def save(run, doc, submit=True, detail=""):
	"""Insert (and submit) one document inside a savepoint; a failure rolls back only this document."""
	if run.dry_run:
		run.log("created", doc.doctype, DRY, detail)
		return DRY
	frappe.db.savepoint("sample_doc")
	try:
		doc.insert()
		if submit:
			doc.submit()
		tag(doc.doctype, doc.name)
		frappe.db.commit()
		run.log("created", doc.doctype, doc.name, detail)
		return doc.name
	except Exception as error:
		frappe.db.rollback(save_point="sample_doc")
		run.log("failed", doc.doctype, "-", f"{detail}: {frappe.utils.cstr(error)[:300]}")
		return None


def reuse_or_none(run, doctype, filters, detail, submit=True):
	"""Existing sample record for this event, submitted if a previous run left it as a draft."""
	names = tagged(doctype, filters)
	if not names:
		return None
	name = names[0]
	if submit and frappe.db.get_value(doctype, name, "docstatus") == 0 and not run.dry_run:
		frappe.get_doc(doctype, name).submit()
		frappe.db.commit()
	run.log("reused", doctype, name, detail)
	return name


# ---------------------------------------------------------------- masters

def ensure_masters(run):
	print("Masters")
	for brand in BRANDS:
		if frappe.db.exists("Brand", brand):
			run.log("reused", "Brand", brand)
		elif not run.dry_run:
			doc = frappe.get_doc({"doctype": "Brand", "brand": brand}).insert()
			tag("Brand", doc.name)
			run.log("created", "Brand", doc.name)
		else:
			run.log("created", "Brand", brand, "(dry run)")

	for code, name, group, brand, _buy, _sell in ITEMS:
		if frappe.db.exists("Item", code):
			run.log("reused", "Item", code)
			continue
		if run.dry_run:
			run.log("created", "Item", code, "(dry run)")
			continue
		doc = frappe.get_doc({
			"doctype": "Item", "item_code": code, "item_name": name, "description": name,
			"item_group": group, "stock_uom": "Nos", "is_stock_item": 1, "include_item_in_manufacturing": group != "Products",
			"brand": brand, "item_defaults": [{"company": COMPANY, "default_warehouse": FINISHED if group == "Products" else STORES}],
		}).insert()
		tag("Item", doc.name)
		run.log("created", "Item", doc.name, name)

	for code, _n, _g, _b, buy, sell in ITEMS:
		for price_list, rate in ((BUYING_LIST, buy), (SELLING_LIST, sell)):
			if rate is None:
				continue
			existing = frappe.db.exists("Item Price", {"item_code": code, "price_list": price_list})
			if existing:
				run.log("reused", "Item Price", existing, f"{code} · {price_list}")
			elif not run.dry_run:
				doc = frappe.get_doc({"doctype": "Item Price", "item_code": code, "price_list": price_list, "price_list_rate": rate}).insert()
				tag("Item Price", doc.name)
				run.log("created", "Item Price", doc.name, f"{code} · {price_list} · {rate}")

	for customer in CUSTOMERS:
		if frappe.db.exists("Customer", customer):
			run.log("reused", "Customer", customer)
		elif not run.dry_run:
			# No email/phone: ERPNext then creates no Contact for the customer.
			doc = frappe.get_doc({"doctype": "Customer", "customer_name": customer, "customer_type": "Company", "customer_group": "Commercial", "territory": "India"}).insert()
			tag("Customer", doc.name)
			run.log("created", "Customer", doc.name)
	frappe.db.commit()


def ensure_reorder_levels(run):
	"""Added last, once Material Requests cover every item below its level, so ERPNext's
	scheduled auto-reorder (Stock Settings › auto_indent) has nothing left to request."""
	print("Reorder levels")
	for code, warehouse, level, qty, request_type in REORDER:
		if not frappe.db.exists("Item", code) or TAG not in (frappe.db.get_value("Item", code, "_user_tags") or ""):
			continue  # only sample items, never existing ones
		item = frappe.get_doc("Item", code)
		if any(row.warehouse == warehouse for row in item.reorder_levels):
			run.log("reused", "Item Reorder", f"{code} @ {warehouse}")
			continue
		if run.dry_run:
			run.log("created", "Item Reorder", f"{code} @ {warehouse}", "(dry run)")
			continue
		item.append("reorder_levels", {"warehouse": warehouse, "warehouse_reorder_level": level, "warehouse_reorder_qty": qty, "material_request_type": request_type})
		item.save()
		frappe.db.commit()
		run.log("created", "Item Reorder", f"{code} @ {warehouse}", f"level {level}, qty {qty}")


# ---------------------------------------------------------------- transactions

def stock_entry(run, date, spec, sequence):
	detail = f"{spec['type']} {date} · {spec['note']}"
	draft = spec.get("draft", False)
	found = reuse_or_none(run, "Stock Entry", {"posting_date": date, "stock_entry_type": spec["type"], "remarks": ["like", f"%{spec['note']}%"]}, detail, submit=not draft)
	if found:
		return found
	doc = frappe.new_doc("Stock Entry")
	doc.stock_entry_type = spec["type"]
	doc.company = COMPANY
	doc.remarks = f"{spec['note']} (sample data)"
	posting(doc, date, sequence)
	for code, qty in spec["items"]:
		row = {"item_code": code, "qty": qty}
		if spec.get("from"):
			row["s_warehouse"] = spec["from"]
		if spec.get("to"):
			row["t_warehouse"] = spec["to"]
		if spec["type"] == "Material Receipt":
			row["basic_rate"] = RATE[code]
		doc.append("items", row)
	return save(run, doc, submit=not draft, detail=detail)


def purchase_order(run, date, spec, sequence):
	detail = f"{spec['supplier']} {date}"
	found = reuse_or_none(run, "Purchase Order", {"supplier": spec["supplier"], "transaction_date": date}, detail)
	if found:
		return found
	schedule = add_days(date, 7)
	doc = frappe.get_doc({
		"doctype": "Purchase Order", "company": COMPANY, "supplier": spec["supplier"], "transaction_date": date, "schedule_date": schedule,
		"buying_price_list": BUYING_LIST,
		"items": [{"item_code": code, "qty": qty, "rate": rate, "warehouse": STORES, "schedule_date": schedule} for code, qty, rate in spec["items"]],
	})
	return save(run, doc, detail=detail)


def purchase_receipt(run, date, spec, sequence):
	from erpnext.buying.doctype.purchase_order.purchase_order import make_purchase_receipt

	if spec.get("from"):
		order = run.refs.get(spec["from"])
		supplier = frappe.db.get_value("Purchase Order", order, "supplier") if order else None
	else:
		order, supplier = None, spec["supplier"]
	detail = f"{supplier or '?'} {date}" + (f" ← {order}" if order else "")
	if order == DRY:
		run.log("created", "Purchase Receipt", DRY, f"{date} ← new Purchase Order")
		return DRY
	if spec.get("from") and not order:
		run.log("failed", "Purchase Receipt", "-", f"{detail}: source Purchase Order was not created")
		return None
	found = reuse_or_none(run, "Purchase Receipt", {"supplier": supplier, "posting_date": date}, detail)
	if found:
		return found
	if order:
		doc = make_purchase_receipt(order)
		for row in doc.items:
			partial = spec.get("qty", {}).get(row.item_code)
			if partial is not None:
				row.qty = row.received_qty = partial
	else:
		doc = frappe.get_doc({
			"doctype": "Purchase Receipt", "company": COMPANY, "supplier": supplier, "buying_price_list": BUYING_LIST,
			"items": [{"item_code": code, "qty": qty, "received_qty": qty, "rate": rate, "warehouse": STORES} for code, qty, rate in spec["items"]],
		})
	posting(doc, date, sequence)
	return save(run, doc, detail=detail)


def purchase_invoice(run, date, spec, sequence):
	from erpnext.stock.doctype.purchase_receipt.purchase_receipt import make_purchase_invoice

	receipt = run.refs.get(spec["from"])
	if receipt == DRY:
		run.log("created", "Purchase Invoice", DRY, f"{date} ← new Purchase Receipt")
		return DRY
	if not receipt:
		run.log("failed", "Purchase Invoice", "-", f"{date}: source Purchase Receipt was not created")
		return None
	supplier = frappe.db.get_value("Purchase Receipt", receipt, "supplier")
	detail = f"{supplier} {date} ← {receipt}"
	found = reuse_or_none(run, "Purchase Invoice", {"supplier": supplier, "posting_date": date}, detail)
	if found:
		return found
	doc = make_purchase_invoice(receipt)
	posting(doc, date, sequence)
	doc.bill_date = date
	doc.due_date = add_days(date, 30)
	return save(run, doc, detail=detail)


def sales_order(run, date, spec, sequence):
	detail = f"{spec['customer']} {date}"
	found = reuse_or_none(run, "Sales Order", {"customer": spec["customer"], "transaction_date": date}, detail)
	if found:
		return found
	delivery = add_days(date, 5)
	doc = frappe.get_doc({
		"doctype": "Sales Order", "company": COMPANY, "customer": spec["customer"], "transaction_date": date, "delivery_date": delivery,
		"selling_price_list": SELLING_LIST, "order_type": "Sales",
		"items": [{"item_code": code, "qty": qty, "rate": PRICE[code], "warehouse": FINISHED, "delivery_date": delivery} for code, qty in spec["items"]],
	})
	return save(run, doc, detail=detail)


def delivery_note(run, date, spec, sequence):
	from erpnext.selling.doctype.sales_order.sales_order import make_delivery_note

	order = run.refs.get(spec["from"])
	if order == DRY:
		run.log("created", "Delivery Note", DRY, f"{date} ← new Sales Order")
		return DRY
	if not order:
		run.log("failed", "Delivery Note", "-", f"{date}: source Sales Order was not created")
		return None
	customer = frappe.db.get_value("Sales Order", order, "customer")
	detail = f"{customer} {date} ← {order}"
	found = reuse_or_none(run, "Delivery Note", {"customer": customer, "posting_date": date}, detail)
	if found:
		return found
	doc = make_delivery_note(order)
	posting(doc, date, sequence)
	return save(run, doc, detail=detail)


def sales_invoice(run, date, spec, sequence):
	from erpnext.stock.doctype.delivery_note.delivery_note import make_sales_invoice

	note = run.refs.get(spec["from"])
	if note == DRY:
		run.log("created", "Sales Invoice", DRY, f"{date} ← new Delivery Note")
		return DRY
	if not note:
		run.log("failed", "Sales Invoice", "-", f"{date}: source Delivery Note was not created")
		return None
	customer = frappe.db.get_value("Delivery Note", note, "customer")
	detail = f"{customer} {date} ← {note}"
	found = reuse_or_none(run, "Sales Invoice", {"customer": customer, "posting_date": date}, detail)
	if found:
		return found
	doc = make_sales_invoice(note)
	posting(doc, date, sequence)
	doc.due_date = add_days(date, 30)
	return save(run, doc, detail=detail)


def material_request(run, date, spec, sequence):
	detail = f"{spec['type']} {date}"
	found = reuse_or_none(run, "Material Request", {"material_request_type": spec["type"], "transaction_date": date}, detail)
	if found:
		return found
	schedule = add_days(date, 7)
	rows = []
	for code, qty in spec["items"]:
		row = {"item_code": code, "qty": qty, "warehouse": spec["warehouse"], "schedule_date": schedule}
		if spec.get("from"):
			row["from_warehouse"] = spec["from"]
		rows.append(row)
	doc = frappe.get_doc({"doctype": "Material Request", "company": COMPANY, "material_request_type": spec["type"], "transaction_date": date, "schedule_date": schedule, "items": rows})
	if spec.get("from"):
		doc.set_from_warehouse = spec["from"]
	doc.set_warehouse = spec["warehouse"]
	return save(run, doc, detail=detail)


HANDLERS = {
	"stock_entry": stock_entry, "purchase_order": purchase_order, "purchase_receipt": purchase_receipt,
	"purchase_invoice": purchase_invoice, "sales_order": sales_order, "delivery_note": delivery_note,
	"sales_invoice": sales_invoice, "material_request": material_request,
}


def check_prerequisites():
	missing = []
	if not frappe.db.exists("Company", COMPANY):
		missing.append(f"Company {COMPANY}")
	for warehouse in (STORES, FINISHED, WIP):
		if not frappe.db.exists("Warehouse", {"name": warehouse, "company": COMPANY, "is_group": 0}):
			missing.append(f"Warehouse {warehouse}")
	for group in {group for _c, _n, group, *_ in ITEMS}:
		if not frappe.db.exists("Item Group", group):
			missing.append(f"Item Group {group}")
	for supplier in ("Tech Supplies", "Demo Supplier", "Marco"):
		if not frappe.db.exists("Supplier", supplier):
			missing.append(f"Supplier {supplier}")
	for customer in ("Tech Solutions", "Demo Customer"):
		if not frappe.db.exists("Customer", customer):
			missing.append(f"Customer {customer}")
	for price_list in (BUYING_LIST, SELLING_LIST):
		if not frappe.db.exists("Price List", price_list):
			missing.append(f"Price List {price_list}")
	if not frappe.db.exists("UOM", "Nos"):
		missing.append("UOM Nos")
	if not frappe.db.get_value("Fiscal Year", {"year_start_date": ["<=", EVENTS[0][1]], "year_end_date": [">=", EVENTS[-1][1]], "disabled": 0}):
		missing.append(f"Fiscal Year covering {EVENTS[0][1]} – {EVENTS[-1][1]}")
	if not frappe.db.get_value("Company", COMPANY, "stock_received_but_not_billed"):
		missing.append("Company › Stock Received But Not Billed account")
	return missing


# ---------------------------------------------------------------- entry points

def seed(dry_run=0):
	frappe.set_user("Administrator")
	run = Run(bool(int(dry_run)))
	missing = check_prerequisites()
	if missing:
		print("Missing ERPNext configuration — nothing was created:\n  " + "\n  ".join(missing))
		return
	print(f"Seeding stock sample data ({'dry run' if run.dry_run else 'writing'}) on {frappe.local.site}")
	ensure_masters(run)
	print("Transactions")
	for sequence, (kind, date, spec) in enumerate(EVENTS):
		name = HANDLERS[kind](run, date, spec, sequence)
		if spec.get("ref"):
			run.refs[spec["ref"]] = name
	ensure_reorder_levels(run)
	print(f"\nDone: {len(run.created)} created, {len(run.reused)} reused, {len(run.failed)} failed.")
	for doctype, name, detail in run.failed:
		print(f"  FAILED {doctype}: {detail}")
	return {"created": len(run.created), "reused": len(run.reused), "failed": run.failed}


def verify():
	"""Read-only: what ERPNext now reports for the sample data."""
	sample_items = [code for code, *_ in ITEMS]
	for doctype in ("Item", "Brand", "Customer", "Item Price", "Material Request", "Purchase Order", "Purchase Receipt", "Purchase Invoice", "Stock Entry", "Sales Order", "Delivery Note", "Sales Invoice"):
		rows = frappe.get_all(doctype, filters={"_user_tags": ["like", f"%{TAG}%"]}, fields=["name", "docstatus"] + (["status"] if frappe.get_meta(doctype).has_field("status") else []))
		summary = {}
		for row in rows:
			key = row.get("status") or ("Submitted" if row.docstatus == 1 else "Draft" if row.docstatus == 0 else "Cancelled")
			summary[key] = summary.get(key, 0) + 1
		print(f"{doctype:18} {len(rows):3}  {summary}")
	bins = frappe.get_all("Bin", filters={"item_code": ["in", sample_items]}, fields=["item_code", "warehouse", "actual_qty", "projected_qty", "stock_value"], order_by="item_code, warehouse")
	print("\nBins (maintained by ERPNext):")
	for row in bins:
		print(f"  {row.item_code} {row.warehouse:22} qty {flt(row.actual_qty):>7}  projected {flt(row.projected_qty):>7}  value {flt(row.stock_value):>12,.2f}")
	total_bin = sum(flt(row.stock_value) for row in frappe.get_all("Bin", fields=["stock_value"]))
	total_sle = flt(frappe.db.sql("select sum(stock_value_difference) from `tabStock Ledger Entry` where is_cancelled = 0 and company = %s", COMPANY)[0][0])
	print(f"\nTotal stock value · Bin: {total_bin:,.2f} · Stock Ledger: {total_sle:,.2f}")
	from erpnext.stock.report.stock_balance.stock_balance import execute as stock_balance
	_columns, data = stock_balance(frappe._dict({"company": COMPANY, "from_date": "2026-04-01", "to_date": frappe.utils.today()}))[:2]
	report_total = sum(flt(row.get("bal_val")) for row in data if isinstance(row, dict))
	print(f"Stock Balance report total: {report_total:,.2f}")
	print("Stock Ledger Entries (sample vouchers):", frappe.db.count("Stock Ledger Entry", {"item_code": ["in", sample_items], "is_cancelled": 0}))
	print("Auto-created Material Requests (untagged, after seeding):", frappe.get_all("Material Request", filters={"_user_tags": ["not like", f"%{TAG}%"], "creation": [">", "2026-10-09"]}, pluck="name"))


def _remove(doctype, name, problems):
	try:
		doc = frappe.get_doc(doctype, name)
		if doc.docstatus == 1:
			doc.cancel()
		frappe.delete_doc(doctype, name)
		frappe.db.commit()
		print(f"  removed {doctype} {name}")
	except Exception as error:
		frappe.db.rollback()
		problems.append(f"{doctype} {name}: {frappe.utils.cstr(error)[:200]}")


def _tagged_all(doctype, fields=("name",)):
	return frappe.get_all(doctype, filters={"_user_tags": ["like", f"%{TAG}%"]}, fields=list(fields))


def cleanup(confirm=None):
	"""Cancel and delete ONLY records tagged "Sample Data". Never run automatically.

	Order respects dependencies: invoices first, then every stock voucher newest-first
	(so no cancellation leaves later movements without stock), then orders and requests,
	then masters. ERPNext's own cancel/delete validations apply; anything they refuse is
	reported and left in place."""
	if confirm != "yes":
		print('Refusing to run without confirm="yes". This cancels and deletes every record tagged "Sample Data".')
		return
	frappe.set_user("Administrator")
	problems = []
	for doctype in ("Sales Invoice", "Purchase Invoice"):
		for row in sorted(_tagged_all(doctype, ("name", "posting_date", "creation")), key=lambda r: (r.posting_date, r.creation), reverse=True):
			_remove(doctype, row.name, problems)
	vouchers = []
	for doctype in ("Delivery Note", "Purchase Receipt", "Stock Entry"):
		vouchers += [(row.posting_date, str(row.posting_time), row.creation, doctype, row.name) for row in _tagged_all(doctype, ("name", "posting_date", "posting_time", "creation"))]
	for *_order, doctype, name in sorted(vouchers, reverse=True):
		_remove(doctype, name, problems)
	for doctype in ("Sales Order", "Purchase Order", "Material Request"):
		for row in sorted(_tagged_all(doctype, ("name", "transaction_date", "creation")), key=lambda r: (r.transaction_date, r.creation), reverse=True):
			_remove(doctype, row.name, problems)
	for doctype in ("Item Price", "Item", "Customer", "Brand"):
		for row in _tagged_all(doctype):
			_remove(doctype, row.name, problems)
	print("\nCleanup finished." + (" Could not remove:\n  " + "\n  ".join(problems) if problems else ""))
