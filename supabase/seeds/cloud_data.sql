SET session_replication_role = replica;

--
-- PostgreSQL database dump
--

-- \restrict wvhO9PGtS1YGYddm3YdL2Xod1TUk28mePD9bohRAe7xSBsmKzMK1jquEKYQjBrM

-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.6

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Data for Name: audit_log_entries; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: custom_oauth_providers; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: flow_state; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: users; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

INSERT INTO "auth"."users" ("instance_id", "id", "aud", "role", "email", "encrypted_password", "email_confirmed_at", "invited_at", "confirmation_token", "confirmation_sent_at", "recovery_token", "recovery_sent_at", "email_change_token_new", "email_change", "email_change_sent_at", "last_sign_in_at", "raw_app_meta_data", "raw_user_meta_data", "is_super_admin", "created_at", "updated_at", "phone", "phone_confirmed_at", "phone_change", "phone_change_token", "phone_change_sent_at", "email_change_token_current", "email_change_confirm_status", "banned_until", "reauthentication_token", "reauthentication_sent_at", "is_sso_user", "deleted_at", "is_anonymous") VALUES
	('00000000-0000-0000-0000-000000000000', '94cbb974-60af-4aa2-8787-fa3afebc8660', 'authenticated', 'authenticated', 'admin@members.stockpilot.local', '$2a$10$ACtyaSwD6zno81q6QmYMcOGc9z1KMfwvxWXcX6Q/TmlLgMj0VOC3y', '2026-04-10 02:07:48.990861+00', NULL, '', NULL, '', NULL, '', '', NULL, '2026-04-11 14:14:36.742339+00', '{"provider": "email", "providers": ["email"]}', '{"is_admin": true, "username": "admin", "email_verified": true}', NULL, '2026-04-10 02:07:48.948305+00', '2026-04-11 14:14:36.813288+00', NULL, NULL, '', '', NULL, '', 0, NULL, '', NULL, false, NULL, false),
	('00000000-0000-0000-0000-000000000000', '56647bc0-fd46-45b5-b97d-9899eb235904', 'authenticated', 'authenticated', 'ahmedhossam@members.stockpilot.local', '$2a$10$e/TVwnewl5ZuTkJkMx/L6egKsOy/HkwLE5yGbRpX9onfzlsbSzE8m', '2026-04-10 02:52:35.272071+00', NULL, '', NULL, '', NULL, '', '', NULL, '2026-04-10 03:24:20.084756+00', '{"provider": "email", "providers": ["email"]}', '{"is_admin": false, "username": "ahmedhossam", "email_verified": true, "feature_overrides": {"orders.hubNew": true, "payments.list": true, "sidebar.admin": false, "orders.hubList": true, "brands.addBrand": true, "orders.editNote": true, "sidebar.control": false, "brands.editBrand": true, "orders.exportCsv": true, "orders.importCsv": true, "people.addPerson": true, "register.deposit": true, "orders.addPayment": true, "people.editPerson": true, "register.withdraw": true, "reports.exportCsv": true, "brands.deleteBrand": true, "orders.cancelOrder": true, "orders.posCheckout": true, "orders.editDraftPos": true, "orders.printInvoice": true, "people.deletePerson": true, "products.addProduct": true, "people.recordPayment": true, "products.editProduct": true, "products.stockAdjust": true, "purchaseOrders.cancel": true, "purchaseOrders.create": true, "register.viewActivity": true, "categories.addCategory": true, "inventory.hubMovements": true, "products.deleteProduct": true, "purchaseOrders.hubList": true, "categories.editCategory": true, "inventoryTransfers.list": true, "payments.editLedgerNote": true, "purchaseOrders.editNote": true, "purchaseOrders.exportCsv": true, "purchaseOrders.importCsv": true, "categories.deleteCategory": true, "inventoryTransfers.create": true, "purchaseOrders.confirmReceive": true, "payments.reverseLedgerOperation": true, "purchaseOrders.costOverridePriceDialog": true}}', NULL, '2026-04-10 02:52:35.23094+00', '2026-04-10 03:24:20.086882+00', NULL, NULL, '', '', NULL, '', 0, NULL, '', NULL, false, NULL, false),
	('00000000-0000-0000-0000-000000000000', '954deeec-da6d-4096-8cdc-0dc950aa8a15', 'authenticated', 'authenticated', 'testing1@members.stockpilot.local', '$2a$10$VpqN2nAaLjhrHgtoWFDfcu/ACT9H0RSsOnM.i.AaUhrr9ERh29/Pa', '2026-04-10 03:25:00.777322+00', NULL, '', NULL, '', NULL, '', '', NULL, '2026-04-10 03:25:12.180125+00', '{"provider": "email", "providers": ["email"]}', '{"is_admin": false, "username": "testing1", "email_verified": true, "feature_overrides": {"orders.hubNew": true, "payments.list": true, "sidebar.admin": false, "orders.hubList": true, "brands.addBrand": true, "orders.editNote": true, "sidebar.control": false, "brands.editBrand": true, "orders.exportCsv": true, "orders.importCsv": true, "people.addPerson": true, "register.deposit": true, "orders.addPayment": true, "people.editPerson": true, "register.withdraw": true, "reports.exportCsv": true, "brands.deleteBrand": true, "orders.cancelOrder": true, "orders.posCheckout": true, "people.viewProfile": true, "orders.editDraftPos": true, "orders.printInvoice": true, "people.deletePerson": true, "products.addProduct": true, "people.recordPayment": true, "products.editProduct": true, "products.stockAdjust": true, "purchaseOrders.cancel": true, "purchaseOrders.create": true, "register.viewActivity": true, "categories.addCategory": true, "inventory.hubMovements": true, "products.deleteProduct": true, "purchaseOrders.hubList": true, "categories.editCategory": true, "inventoryTransfers.list": true, "payments.editLedgerNote": true, "payments.fullLedgerView": true, "purchaseOrders.editNote": true, "purchaseOrders.exportCsv": true, "purchaseOrders.importCsv": true, "categories.deleteCategory": true, "inventoryTransfers.create": true, "purchaseOrders.confirmReceive": true, "payments.reverseLedgerOperation": true, "purchaseOrders.costOverridePriceDialog": true}}', NULL, '2026-04-10 03:25:00.759478+00', '2026-04-10 03:25:12.182376+00', NULL, NULL, '', '', NULL, '', 0, NULL, '', NULL, false, NULL, false);


--
-- Data for Name: identities; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

INSERT INTO "auth"."identities" ("provider_id", "user_id", "identity_data", "provider", "last_sign_in_at", "created_at", "updated_at", "id") VALUES
	('94cbb974-60af-4aa2-8787-fa3afebc8660', '94cbb974-60af-4aa2-8787-fa3afebc8660', '{"sub": "94cbb974-60af-4aa2-8787-fa3afebc8660", "email": "admin@members.stockpilot.local", "email_verified": false, "phone_verified": false}', 'email', '2026-04-10 02:07:48.985799+00', '2026-04-10 02:07:48.985866+00', '2026-04-10 02:07:48.985866+00', '4e093002-cb08-4e03-aa26-41c69a5e2f21'),
	('56647bc0-fd46-45b5-b97d-9899eb235904', '56647bc0-fd46-45b5-b97d-9899eb235904', '{"sub": "56647bc0-fd46-45b5-b97d-9899eb235904", "email": "ahmedhossam@members.stockpilot.local", "email_verified": false, "phone_verified": false}', 'email', '2026-04-10 02:52:35.267737+00', '2026-04-10 02:52:35.267795+00', '2026-04-10 02:52:35.267795+00', '9d870366-6b11-4501-b747-fbdd18c67d09'),
	('954deeec-da6d-4096-8cdc-0dc950aa8a15', '954deeec-da6d-4096-8cdc-0dc950aa8a15', '{"sub": "954deeec-da6d-4096-8cdc-0dc950aa8a15", "email": "testing1@members.stockpilot.local", "email_verified": false, "phone_verified": false}', 'email', '2026-04-10 03:25:00.772508+00', '2026-04-10 03:25:00.772572+00', '2026-04-10 03:25:00.772572+00', '4bc53c91-62cc-4e9e-aaab-8a611acc3a47');


--
-- Data for Name: instances; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: oauth_clients; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: sessions; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

INSERT INTO "auth"."sessions" ("id", "user_id", "created_at", "updated_at", "factor_id", "aal", "not_after", "refreshed_at", "user_agent", "ip", "tag", "oauth_client_id", "refresh_token_hmac_key", "refresh_token_counter", "scopes") VALUES
	('eb232b4e-e7df-4f03-af11-8221ede9c141', '94cbb974-60af-4aa2-8787-fa3afebc8660', '2026-04-11 14:14:36.742437+00', '2026-04-11 14:14:36.742437+00', NULL, 'aal1', NULL, NULL, 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Cursor/2.6.20 Chrome/142.0.7444.265 Electron/39.8.1 Safari/537.36', '41.42.187.121', NULL, NULL, NULL, NULL, NULL);


--
-- Data for Name: mfa_amr_claims; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

INSERT INTO "auth"."mfa_amr_claims" ("session_id", "created_at", "updated_at", "authentication_method", "id") VALUES
	('eb232b4e-e7df-4f03-af11-8221ede9c141', '2026-04-11 14:14:36.823811+00', '2026-04-11 14:14:36.823811+00', 'password', 'f35bb391-caa9-455b-9fbd-19016d4166d5');


--
-- Data for Name: mfa_factors; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: mfa_challenges; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: oauth_authorizations; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: oauth_client_states; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: oauth_consents; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: one_time_tokens; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: refresh_tokens; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

INSERT INTO "auth"."refresh_tokens" ("instance_id", "id", "token", "user_id", "revoked", "created_at", "updated_at", "parent", "session_id") VALUES
	('00000000-0000-0000-0000-000000000000', 17, '7t73n55infat', '94cbb974-60af-4aa2-8787-fa3afebc8660', false, '2026-04-11 14:14:36.787628+00', '2026-04-11 14:14:36.787628+00', NULL, 'eb232b4e-e7df-4f03-af11-8221ede9c141');


--
-- Data for Name: sso_providers; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: saml_providers; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: saml_relay_states; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: sso_domains; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: webauthn_challenges; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: webauthn_credentials; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: people; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."people" ("id", "name", "phone", "address", "notes", "roles", "balance", "discount_rate", "credit_limit", "created_at", "updated_at") VALUES
	('355ddf91-4d5a-4c80-bd3a-3c1e6cdfbb2c', 'Supplier', '010000000000', NULL, NULL, '{supplier}', -42619.00, 0.00, NULL, '2026-03-31 21:38:38.60936+00', '2026-04-04 23:24:04.065+00'),
	('91810f5e-4dbe-4126-ba9b-e21fc12f41cf', 'Hossss', '010900', '222', '332', '{customer}', 5440.00, 0.00, NULL, '2026-04-03 22:13:31.363822+00', '2026-04-07 22:51:48.886+00'),
	('838f5c75-7728-4383-9ce5-da876bb5386b', 'Ahmed Hossam', 'dsdfsdfsdf', 'dsfsdfsdfsdf', 'sdfsdfsdfsdf', '{customer,supplier}', -1150.00, 10.00, NULL, '2026-03-28 22:57:10.725347+00', '2026-04-08 03:24:42.75+00'),
	('4c1d61ed-1c61-4536-beec-6f98d74a90f9', 'ahmed', '123', NULL, NULL, '{supplier}', 0.00, 0.00, NULL, '2026-04-09 02:14:18.167389+00', '2026-04-09 02:14:18.167389+00'),
	('72b6d4eb-cef2-4c84-9968-9f8f0c40a076', 'Ali', '1234', NULL, NULL, '{supplier}', -120.00, 0.00, NULL, '2026-04-09 02:14:18.707329+00', '2026-04-09 02:14:19.316+00'),
	('5b0f3cef-56d7-4f3a-973b-a15dc782210a', 'Hossam', '12345', NULL, NULL, '{supplier}', 23.00, 0.00, NULL, '2026-04-09 02:14:20.019359+00', '2026-04-09 02:14:20.437+00'),
	('683f6472-1f18-4244-aa3a-037a17e9ab3c', 'Kamal', '123456', NULL, NULL, '{supplier}', 45.00, 0.00, NULL, '2026-04-09 02:14:20.974887+00', '2026-04-09 02:14:21.466+00');


--
-- Data for Name: warehouses; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."warehouses" ("id", "name", "location", "is_default", "created_at", "updated_at", "has_register", "code") VALUES
	(1, 'default', NULL, true, '2026-04-07 22:46:37.451888+00', '2026-04-10 03:46:02.041+00', true, 'DEFAULT-01'),
	(2, 'inventory 2', NULL, false, '2026-04-07 22:50:35.738667+00', '2026-04-09 23:41:55.048+00', false, 'WH-0002');


--
-- Data for Name: balance_transactions; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."balance_transactions" ("id", "person_id", "type", "amount", "reference_id", "reference_number", "note", "created_at", "payment_method", "payment_group_id", "wallet_direction", "reversed_at", "register_warehouse_id") VALUES
	('9b1fb2d1-7c5e-4d8f-aa81-33310634bd31', '838f5c75-7728-4383-9ce5-da876bb5386b', 'purchase_order', -668.00, '684279d6-5d4f-4472-a578-9343ed0a5365', 'PO-4', NULL, '2026-03-28 22:58:27.524611+00', NULL, NULL, NULL, NULL, NULL),
	('c6380710-7832-4fbc-961a-6cbbad1ceaa2', '838f5c75-7728-4383-9ce5-da876bb5386b', 'order', 345.00, 'b2111665-993c-4dfb-84ca-fc2fb20de6af', '8', NULL, '2026-03-28 22:59:10.964471+00', NULL, NULL, NULL, NULL, NULL),
	('357c0dad-8812-4de2-81a4-8b0e38eb69b5', '838f5c75-7728-4383-9ce5-da876bb5386b', 'order', 2448.00, '5f370fc2-113a-49d6-874e-19b5210c2a0b', '9', NULL, '2026-03-28 23:00:49.411321+00', NULL, NULL, NULL, NULL, NULL),
	('124cce80-7c7f-4efd-9550-9b939a9966c8', '838f5c75-7728-4383-9ce5-da876bb5386b', 'order', 979.20, '2aec1109-d9b7-433a-8106-22ad13090685', '10', NULL, '2026-03-28 23:52:57.815102+00', NULL, NULL, NULL, NULL, NULL),
	('0d4551eb-5129-442f-aa56-ef5afa09aa0d', NULL, 'order', 544.00, '4b687a20-9b84-44c0-97ea-3de9f6d43e37', 'O-57', NULL, '2026-04-08 02:30:52.62569+00', NULL, NULL, NULL, '2026-04-08 02:46:52.914+00', NULL),
	('3a3add44-db4b-48f4-9441-01fd92b60467', '838f5c75-7728-4383-9ce5-da876bb5386b', 'purchase_order', -100.00, 'b0e8b94f-ff38-41bf-9b24-a8941d288f3f', 'PO-5', NULL, '2026-03-29 00:13:13.640287+00', NULL, NULL, NULL, NULL, NULL),
	('901b8e0b-4f05-4276-b4cb-ae55930ebead', '838f5c75-7728-4383-9ce5-da876bb5386b', 'order', 135.00, '1fba40f7-6193-4f3e-91c7-ab141e109f43', '11', NULL, '2026-03-29 00:29:06.91005+00', NULL, NULL, NULL, NULL, NULL),
	('778ff74a-7a39-4bad-9019-b4750276c241', '838f5c75-7728-4383-9ce5-da876bb5386b', 'order', 544.00, 'a48a508a-7239-4e6b-a43f-3fcd4c9a92cd', '13', NULL, '2026-03-29 00:55:00.991674+00', NULL, NULL, NULL, NULL, NULL),
	('e63e3fbc-448b-4c5e-9580-0b0d88fa0e54', NULL, 'payment_in', -544.00, '6d2e97d7-d05b-4028-aab8-fda2ed42f6de', 'O-58', 'Order payment', '2026-04-08 02:58:10.393013+00', 'instapay', NULL, NULL, '2026-04-08 02:58:42.102+00', 2),
	('75e081e2-9c30-4d9a-97e7-75f112cf609b', '838f5c75-7728-4383-9ce5-da876bb5386b', 'order', 5443.00, '2d9e8bf7-ed2f-44c3-96b5-1e707ce8f156', '15', NULL, '2026-03-29 01:09:32.58925+00', NULL, NULL, NULL, NULL, NULL),
	('56847347-6185-4848-bf7c-d8ad66163247', '838f5c75-7728-4383-9ce5-da876bb5386b', 'purchase_order', -336.01, '7b436be1-8446-4c14-bdd4-512532c19000', 'PO-6', NULL, '2026-03-30 01:33:57.811907+00', NULL, NULL, NULL, NULL, NULL),
	('88535be6-5382-4f90-b243-ca6afd9c7a79', '838f5c75-7728-4383-9ce5-da876bb5386b', 'purchase_order', -5344.00, '1e9666fe-5072-42b1-b43f-5cd11b06399b', 'PO-7', NULL, '2026-03-30 01:45:34.109875+00', NULL, NULL, NULL, NULL, NULL),
	('9977e8c0-8135-4bca-996c-7737daa302ae', NULL, 'order', 544.00, '379b1388-e18c-4e71-a9cc-db957bb5cbd8', 'O-60', NULL, '2026-04-09 23:41:24.679603+00', NULL, NULL, NULL, NULL, NULL),
	('bec7d5e5-a349-4c4a-b420-7711af1de616', '355ddf91-4d5a-4c80-bd3a-3c1e6cdfbb2c', 'purchase_order', -90.00, '234d7f03-a17c-4496-8d65-a2795ed3cc1a', 'PO-9', NULL, '2026-03-31 21:49:43.847268+00', NULL, NULL, NULL, NULL, NULL),
	('3a43230a-db28-4150-81bc-1273108e6217', '838f5c75-7728-4383-9ce5-da876bb5386b', 'order', 120.00, '4dece1dd-e707-416b-a273-c5ad3a246371', '16', NULL, '2026-03-31 21:50:44.348505+00', NULL, NULL, NULL, NULL, NULL),
	('250945b1-ae31-4e2d-9138-d2c05d04ff22', '355ddf91-4d5a-4c80-bd3a-3c1e6cdfbb2c', 'purchase_order', -90.00, '858dac90-2a6a-41a4-9b28-125203cb5e99', 'PO-10', NULL, '2026-03-31 22:06:35.304262+00', NULL, NULL, NULL, NULL, NULL),
	('8e26f23b-42f7-4eea-83c9-d132ec73d9db', '838f5c75-7728-4383-9ce5-da876bb5386b', 'order', 240.00, 'c45005fd-e17c-41a4-b720-ed7d4a78d332', '19', NULL, '2026-03-31 22:14:52.073724+00', NULL, NULL, NULL, NULL, NULL),
	('09cbfb77-3e49-4b63-860f-6fc25112e783', '838f5c75-7728-4383-9ce5-da876bb5386b', 'order', 544.00, '3db56bd1-2707-4759-afc5-2c81dd0545c4', '20', NULL, '2026-03-31 22:29:55.253038+00', NULL, NULL, NULL, NULL, NULL),
	('1c7628c5-f73c-429d-bf29-ea9a4b8cdf12', '355ddf91-4d5a-4c80-bd3a-3c1e6cdfbb2c', 'purchase_order', -334.00, '2248f779-234e-4414-a6fe-a12d81041429', 'PO-11', NULL, '2026-03-31 22:31:01.866246+00', NULL, NULL, NULL, NULL, NULL),
	('88895793-9ebd-4642-91f8-50e1d480c73a', '838f5c75-7728-4383-9ce5-da876bb5386b', 'order', 544.00, 'fce7f76d-6937-46bb-8bc3-71002b626f4b', '21', NULL, '2026-03-31 22:44:08.894529+00', NULL, NULL, NULL, NULL, NULL),
	('ff3022dd-30dc-4b07-9e96-df9d36c0a8b7', '355ddf91-4d5a-4c80-bd3a-3c1e6cdfbb2c', 'purchase_order', -334.00, '1dfbcdf0-7090-4d04-a001-9736e61e9862', 'PO-13', NULL, '2026-03-31 22:45:28.030622+00', NULL, NULL, NULL, NULL, NULL),
	('530e77ad-268e-40cf-a5ef-ad7c43794a44', '838f5c75-7728-4383-9ce5-da876bb5386b', 'order', 544.00, 'b750534c-d423-437c-8d43-2700338ce07e', '22', NULL, '2026-03-31 22:47:40.741277+00', NULL, NULL, NULL, NULL, NULL),
	('fccb5191-e4fe-4a53-a702-3858b1493224', '838f5c75-7728-4383-9ce5-da876bb5386b', 'order', 544.00, '65388b17-59d4-4a18-bb75-caa49644d66d', '23', NULL, '2026-03-31 23:06:30.458921+00', NULL, NULL, NULL, NULL, NULL),
	('c275dbe1-23b2-4075-bdf4-bcc572d26e5c', '838f5c75-7728-4383-9ce5-da876bb5386b', 'order', 544.00, '7203a5f1-d1fb-4665-abf2-21ee91086ca5', '24', NULL, '2026-03-31 23:06:56.569525+00', NULL, NULL, NULL, NULL, NULL),
	('8de4694e-8bb0-41ac-8b50-0acbba587835', '355ddf91-4d5a-4c80-bd3a-3c1e6cdfbb2c', 'purchase_order', -334.00, '82420264-c749-4d90-83f3-6c9ca3cd659a', 'PO-14', NULL, '2026-03-31 23:08:48.668575+00', NULL, NULL, NULL, NULL, NULL),
	('e3dbc14d-08c1-4686-b676-9cb3a9dfb3c4', '838f5c75-7728-4383-9ce5-da876bb5386b', 'order', 544.00, '46baeabf-bbd9-4afa-988b-6c204dc9a253', '26', NULL, '2026-03-31 23:23:55.648785+00', NULL, NULL, NULL, NULL, NULL),
	('251f843c-0dc1-402f-bb0a-dd84a63060a5', '838f5c75-7728-4383-9ce5-da876bb5386b', 'order', 544.00, '9b4cf31f-a2e0-4bbd-af84-07376f0dddfa', '27', NULL, '2026-03-31 23:38:49.487376+00', NULL, NULL, NULL, NULL, NULL),
	('18060727-77b1-4cce-b779-67635cdafba0', '838f5c75-7728-4383-9ce5-da876bb5386b', 'payment_out', 788.00, NULL, NULL, NULL, '2026-03-28 22:59:43.363698+00', NULL, NULL, NULL, NULL, 1),
	('1ab8883a-73ee-4efe-88fe-7e064c16e2fd', '355ddf91-4d5a-4c80-bd3a-3c1e6cdfbb2c', 'purchase_order', -334.00, '9d330912-f708-41cf-b9db-4dddf9ea40ea', 'PO-15', NULL, '2026-03-31 23:39:42.804854+00', NULL, NULL, NULL, NULL, NULL),
	('d1e7d394-053e-4833-a53a-932d4c6a7d78', NULL, 'payment_in', -544.00, '4b687a20-9b84-44c0-97ea-3de9f6d43e37', 'O-57', 'Order payment', '2026-04-08 02:30:52.80973+00', 'visa', NULL, NULL, '2026-04-08 02:46:52.067+00', 1),
	('75357677-6358-4a74-a050-e4856888815e', NULL, 'adjustment', 544.00, '6d2e97d7-d05b-4028-aab8-fda2ed42f6de', 'O-58', 'Reversal of recorded payment', '2026-04-08 02:58:42.087232+00', NULL, NULL, NULL, NULL, NULL),
	('919ba231-a1f1-4076-bfb8-d1ed9fc3586a', NULL, 'payment_in', -544.00, '379b1388-e18c-4e71-a9cc-db957bb5cbd8', 'O-60', 'Order payment', '2026-04-09 23:41:24.791754+00', 'cash', NULL, NULL, NULL, 2),
	('6028d746-7963-40c4-97fc-e5edbdafac34', NULL, 'order', 544.00, 'c0f1704a-0587-41c1-8cdc-13cf41d71446', '28', NULL, '2026-04-01 00:03:15.692106+00', NULL, NULL, NULL, NULL, NULL),
	('c3f7d399-bb61-46d0-833e-96c3c0c495fa', NULL, 'order', 544.00, '0c8182d1-244c-44c7-b8ad-a98697ad5bdd', 'O-29', NULL, '2026-04-01 22:27:55.655707+00', NULL, NULL, NULL, NULL, NULL),
	('97b053a7-7767-4703-8b80-bbca0023e34f', NULL, 'order', 144.00, '46002391-dd3b-4983-92cd-c6cee34a8eca', 'O-30', NULL, '2026-04-01 22:29:22.933858+00', NULL, NULL, NULL, NULL, NULL),
	('ff956905-79a9-4f52-831e-d75e625fa435', '355ddf91-4d5a-4c80-bd3a-3c1e6cdfbb2c', 'adjustment', 45.00, NULL, 'PI-1', 'Reversal of recorded payment', '2026-04-01 23:56:05.755326+00', NULL, NULL, NULL, NULL, NULL),
	('3b2907cb-594d-4ea0-878a-d35fac7a950a', '355ddf91-4d5a-4c80-bd3a-3c1e6cdfbb2c', 'adjustment', 50.00, NULL, 'PI-1', 'Reversal of recorded payment', '2026-04-01 23:56:05.882478+00', NULL, NULL, NULL, NULL, NULL),
	('3c295f7a-2cb1-4530-8e5d-f3ca43c0ba57', '355ddf91-4d5a-4c80-bd3a-3c1e6cdfbb2c', 'adjustment', 45.00, NULL, 'PI-1', 'Reversal of recorded payment', '2026-04-01 23:56:12.875505+00', NULL, NULL, NULL, NULL, NULL),
	('6a6b4dc6-fe0f-46e0-9c37-2f16b4d645cf', '355ddf91-4d5a-4c80-bd3a-3c1e6cdfbb2c', 'adjustment', 50.00, NULL, 'PI-1', 'Reversal of recorded payment', '2026-04-01 23:56:13.095614+00', NULL, NULL, NULL, NULL, NULL),
	('b3a8e795-8558-494b-951e-e73dc6257a5f', '355ddf91-4d5a-4c80-bd3a-3c1e6cdfbb2c', 'adjustment', 45.00, NULL, 'PI-1', 'Reversal of recorded payment', '2026-04-01 23:56:19.955121+00', NULL, NULL, NULL, NULL, NULL),
	('92f1ae39-dae3-4efc-8cb0-b84af72aac5c', '355ddf91-4d5a-4c80-bd3a-3c1e6cdfbb2c', 'adjustment', 50.00, NULL, 'PI-1', 'Reversal of recorded payment', '2026-04-01 23:56:20.070454+00', NULL, NULL, NULL, NULL, NULL),
	('378e9eda-3c8e-4abc-86e0-b2fcd3acf5c9', '355ddf91-4d5a-4c80-bd3a-3c1e6cdfbb2c', 'adjustment', 45.00, NULL, 'PI-1', 'Reversal of recorded payment', '2026-04-01 23:56:28.2221+00', NULL, NULL, NULL, NULL, NULL),
	('bda3fe6e-7fd4-4f04-98b6-0d17fa90503e', '355ddf91-4d5a-4c80-bd3a-3c1e6cdfbb2c', 'adjustment', 50.00, NULL, 'PI-1', 'Reversal of recorded payment', '2026-04-01 23:56:28.337022+00', NULL, NULL, NULL, NULL, NULL),
	('28fb9e57-e5fc-4090-b564-e1728ba625fe', '355ddf91-4d5a-4c80-bd3a-3c1e6cdfbb2c', 'adjustment', 45.00, NULL, 'PI-1', 'Reversal of recorded payment', '2026-04-02 00:01:09.278474+00', NULL, NULL, NULL, NULL, NULL),
	('42749e51-fab3-44ce-869b-f4a64f3a9b13', '355ddf91-4d5a-4c80-bd3a-3c1e6cdfbb2c', 'adjustment', 50.00, NULL, 'PI-1', 'Reversal of recorded payment', '2026-04-02 00:01:09.394631+00', NULL, NULL, NULL, NULL, NULL),
	('9a1c76f8-9f6d-44af-a51a-4ac23e097aea', '355ddf91-4d5a-4c80-bd3a-3c1e6cdfbb2c', 'adjustment', 363.00, NULL, 'PI-2', 'Reversal of recorded payment', '2026-04-02 00:02:22.725575+00', NULL, NULL, NULL, NULL, NULL),
	('59659aa8-f48d-4845-98b7-f0c565c44c66', '355ddf91-4d5a-4c80-bd3a-3c1e6cdfbb2c', 'adjustment', 499.94, '3ad4231f-7a79-4a4b-9e29-71aa76cf2815', 'PI-3', 'Reversal of recorded payment', '2026-04-02 00:08:23.086624+00', NULL, NULL, NULL, NULL, NULL),
	('0fed7976-0c36-4c84-bc19-ce00dbb9caab', '355ddf91-4d5a-4c80-bd3a-3c1e6cdfbb2c', 'adjustment', 499.94, '3ad4231f-7a79-4a4b-9e29-71aa76cf2815', 'PI-3', 'Reversal of recorded payment', '2026-04-02 00:18:11.846463+00', NULL, NULL, NULL, NULL, NULL),
	('a953946c-d6d5-4195-adff-461d223e3043', '838f5c75-7728-4383-9ce5-da876bb5386b', 'order', 544.00, 'fef6ef84-ff47-4b69-83d5-7db75bdd0fab', 'O-31', NULL, '2026-04-02 00:18:58.230988+00', NULL, NULL, NULL, NULL, NULL),
	('ef158195-04ce-44c7-a2ef-fda85fdb6d64', '838f5c75-7728-4383-9ce5-da876bb5386b', 'adjustment', -544.00, 'fef6ef84-ff47-4b69-83d5-7db75bdd0fab', 'O-31', 'Cancelled order #31', '2026-04-02 00:19:39.682879+00', NULL, NULL, NULL, NULL, NULL),
	('3653ac7f-4fd3-4ad7-9189-4fd7d064dd5c', '838f5c75-7728-4383-9ce5-da876bb5386b', 'order', 544.00, '90334559-1459-4a79-beb5-01a76ad51f9d', 'O-32', NULL, '2026-04-02 00:20:08.110748+00', NULL, NULL, NULL, NULL, NULL),
	('c9d6bf20-825d-47f8-afd3-2cf032558ff5', '838f5c75-7728-4383-9ce5-da876bb5386b', 'adjustment', -344.00, '90334559-1459-4a79-beb5-01a76ad51f9d', 'O-32', 'Cancelled order #32', '2026-04-02 00:20:55.232377+00', NULL, NULL, NULL, NULL, NULL),
	('9b6b2372-bad0-4b48-838d-df5887644a46', '355ddf91-4d5a-4c80-bd3a-3c1e6cdfbb2c', 'purchase_order', -33400.00, '4d10da78-b34d-4b28-8755-3365103f1f51', 'PO-16', NULL, '2026-04-02 00:28:07.026176+00', NULL, NULL, NULL, NULL, NULL),
	('365c7e86-8dd0-498e-9217-aac6395700ae', '355ddf91-4d5a-4c80-bd3a-3c1e6cdfbb2c', 'purchase_order', 33400.00, '4d10da78-b34d-4b28-8755-3365103f1f51', 'PO-16', NULL, '2026-04-02 00:28:39.251544+00', NULL, NULL, NULL, NULL, NULL),
	('e471ec62-647b-417c-a417-d683af7a83e2', '355ddf91-4d5a-4c80-bd3a-3c1e6cdfbb2c', 'adjustment', 100.00, 'acb424a8-c5ce-4a1c-bb61-080375ba9e14', 'PI-4', 'Reversal of recorded payment', '2026-04-02 00:29:51.071819+00', NULL, NULL, NULL, NULL, NULL),
	('6d9a8b3d-8f92-4321-a18e-e514be4f809c', '355ddf91-4d5a-4c80-bd3a-3c1e6cdfbb2c', 'adjustment', 999.95, '83593a37-3a3d-4b70-9eaa-a64f3f2adea9', 'PI-4', 'Reversal of recorded payment', '2026-04-02 00:29:51.179478+00', NULL, NULL, NULL, NULL, NULL),
	('c643514e-2dc3-49f6-a1bb-43cdd9ce7e9f', '355ddf91-4d5a-4c80-bd3a-3c1e6cdfbb2c', 'purchase_order', -334.00, '7384a9fd-22de-437b-92ed-355fce028dcf', 'PO-17', NULL, '2026-04-02 00:46:48.135675+00', NULL, NULL, NULL, NULL, NULL),
	('120bdab0-2d0b-4dc2-ab2d-3973974006cf', '355ddf91-4d5a-4c80-bd3a-3c1e6cdfbb2c', 'purchase_order', 334.00, '7384a9fd-22de-437b-92ed-355fce028dcf', 'PO-17', NULL, '2026-04-02 00:47:52.705914+00', NULL, NULL, NULL, NULL, NULL),
	('4c864c3a-bbcd-425e-b11a-81194d5c111c', '355ddf91-4d5a-4c80-bd3a-3c1e6cdfbb2c', 'purchase_order', -334.00, '716e3a54-c389-426d-af82-2174ab3f5e7d', 'PO-18', NULL, '2026-04-02 00:53:17.791983+00', NULL, NULL, NULL, NULL, NULL),
	('837fd2cd-58a8-4986-900f-259721fbaaa6', '355ddf91-4d5a-4c80-bd3a-3c1e6cdfbb2c', 'purchase_order', 334.00, '716e3a54-c389-426d-af82-2174ab3f5e7d', 'PO-18', NULL, '2026-04-02 00:53:59.314222+00', NULL, NULL, NULL, NULL, NULL),
	('0cf6fa82-138d-4a04-a572-7bb4ef880343', '355ddf91-4d5a-4c80-bd3a-3c1e6cdfbb2c', 'adjustment', -50.00, '716e3a54-c389-426d-af82-2174ab3f5e7d', 'PO-18', 'Reversal of recorded payment', '2026-04-02 00:54:39.580497+00', NULL, NULL, NULL, NULL, NULL),
	('93ba96ab-2afa-44dd-98f1-21fa24f16dd7', '355ddf91-4d5a-4c80-bd3a-3c1e6cdfbb2c', 'purchase_order', -1000.00, '34045aed-4613-426d-b4b1-42dc39dcdad2', 'PO-19', NULL, '2026-04-02 01:04:07.624371+00', NULL, NULL, NULL, NULL, NULL),
	('16e84d32-50c9-4395-874d-25bd9c0d08d5', '355ddf91-4d5a-4c80-bd3a-3c1e6cdfbb2c', 'purchase_order', 1000.00, '34045aed-4613-426d-b4b1-42dc39dcdad2', 'PO-19', NULL, '2026-04-02 01:04:54.370218+00', NULL, NULL, NULL, NULL, NULL),
	('f6c90aff-7e3b-4774-99b0-797ae313b408', '355ddf91-4d5a-4c80-bd3a-3c1e6cdfbb2c', 'purchase_order', -23380.00, '38695d77-2676-4f42-b085-5552a7b4e91b', 'PO-20', NULL, '2026-04-02 01:26:04.031991+00', NULL, NULL, NULL, NULL, NULL),
	('4da258b9-7ee7-41ad-83c0-df95e8182f6e', '355ddf91-4d5a-4c80-bd3a-3c1e6cdfbb2c', 'purchase_order', 23380.00, '38695d77-2676-4f42-b085-5552a7b4e91b', 'PO-20', NULL, '2026-04-02 01:26:33.689388+00', NULL, NULL, NULL, NULL, NULL),
	('f95a23ba-8fec-446a-9b51-98958dd211e4', '838f5c75-7728-4383-9ce5-da876bb5386b', 'order', 544.00, '5067510d-8cf8-4e95-84e1-68136d1e9ae7', 'O-33', NULL, '2026-04-02 01:27:48.185839+00', NULL, NULL, NULL, NULL, NULL),
	('908afb2b-c791-4113-a2e8-8f4ec5b3dbff', NULL, 'adjustment', 544.00, '4b687a20-9b84-44c0-97ea-3de9f6d43e37', 'O-57', 'Reversal of recorded payment', '2026-04-08 02:46:52.049613+00', NULL, NULL, NULL, NULL, NULL),
	('54a20d79-c898-4a0f-b6fd-251a71dcf2a7', '838f5c75-7728-4383-9ce5-da876bb5386b', 'adjustment', -444.00, '5067510d-8cf8-4e95-84e1-68136d1e9ae7', 'O-33', 'Cancelled order #33', '2026-04-02 01:27:58.301095+00', NULL, NULL, NULL, NULL, NULL),
	('3974ad6c-ae84-41d2-8313-05ee38de1b5a', '838f5c75-7728-4383-9ce5-da876bb5386b', 'order', 544.00, 'fdaa4a83-19af-4420-9410-66c649612905', 'O-34', NULL, '2026-04-02 01:35:07.314403+00', NULL, NULL, NULL, NULL, NULL),
	('75074efa-b037-4af7-b0f7-1a3f3ca20399', '838f5c75-7728-4383-9ce5-da876bb5386b', 'purchase_order', -35.00, '1f295127-ef94-4387-968b-46618631c31c', 'PO-35', NULL, '2026-04-08 03:24:42.589423+00', NULL, NULL, NULL, NULL, NULL),
	('d3420dfe-4f32-482e-88c9-c499cdc0521d', NULL, 'register_withdraw', 544.00, NULL, 'REG-MNS4FPP4-D154C5', 'Withdraw all (clear register)', '2026-04-09 23:41:48.560463+00', 'cash', NULL, NULL, NULL, 2),
	('15a403ae-20c1-404f-bfd1-caf641224055', '838f5c75-7728-4383-9ce5-da876bb5386b', 'order', -544.00, 'fdaa4a83-19af-4420-9410-66c649612905', 'O-34', NULL, '2026-04-02 01:35:29.834496+00', NULL, NULL, NULL, NULL, NULL),
	('1e7f6d9b-4865-43cc-9872-315ffb678b3b', '355ddf91-4d5a-4c80-bd3a-3c1e6cdfbb2c', 'adjustment', 200.00, '1e1bae3a-706d-4cf4-8f30-151ef091d722', 'PI-5', 'Reversal of recorded payment', '2026-04-02 01:50:11.753059+00', NULL, NULL, NULL, NULL, NULL),
	('e727a271-b22c-426d-be37-2c4e25139842', '838f5c75-7728-4383-9ce5-da876bb5386b', 'order', -544.00, '9b4cf31f-a2e0-4bbd-af84-07376f0dddfa', 'O-27', NULL, '2026-04-02 01:51:27.373271+00', NULL, NULL, NULL, NULL, NULL),
	('b474873e-4d10-4c0b-86c5-ee1c2a11a71a', NULL, 'order', 544.00, 'abab5267-cd88-43ef-942f-54020fd5e54f', 'O-35', NULL, '2026-04-02 01:52:44.342065+00', NULL, NULL, NULL, NULL, NULL),
	('2c3d4d5e-71d6-4358-80ef-b588d9643731', NULL, 'order', 544.00, '92b40023-af9c-43a1-9ea7-aed1265a3259', 'O-36', NULL, '2026-04-02 01:54:31.829158+00', NULL, NULL, NULL, NULL, NULL),
	('6ccb4fd7-a8cc-4142-adc4-10cf79c24ce5', '838f5c75-7728-4383-9ce5-da876bb5386b', 'purchase_order', -334.00, '0950e2fa-2f1a-43c5-8cd2-27d2b17d9130', 'PO-21', NULL, '2026-04-02 01:55:09.815008+00', NULL, NULL, NULL, NULL, NULL),
	('7061ee25-b1c5-4a9c-9d2b-411f2664987d', '838f5c75-7728-4383-9ce5-da876bb5386b', 'purchase_order', 334.00, '0950e2fa-2f1a-43c5-8cd2-27d2b17d9130', 'PO-21', NULL, '2026-04-02 01:55:18.448137+00', NULL, NULL, NULL, NULL, NULL),
	('90543968-2850-4e10-b596-ae02ff130429', '838f5c75-7728-4383-9ce5-da876bb5386b', 'order', 544.00, '164ff500-0ea5-4eb5-afd5-084b1ab48f14', 'O-37', NULL, '2026-04-02 03:06:54.406697+00', NULL, NULL, NULL, NULL, NULL),
	('98e0bc79-97b9-4222-ad89-27f961a3b9f5', '838f5c75-7728-4383-9ce5-da876bb5386b', 'order', -544.00, '164ff500-0ea5-4eb5-afd5-084b1ab48f14', 'O-37', NULL, '2026-04-02 03:08:36.376842+00', NULL, NULL, NULL, NULL, NULL),
	('ac63debb-40f6-4119-9c14-c53d5ceeeaaa', '355ddf91-4d5a-4c80-bd3a-3c1e6cdfbb2c', 'purchase_order', -334.00, '02fc9c1f-284f-4d0c-ae6e-d16a4cbd8147', 'PO-22', NULL, '2026-04-02 03:09:58.57937+00', NULL, NULL, NULL, NULL, NULL),
	('a577ad9c-cf1a-46f1-a0fe-e69e7144a882', '838f5c75-7728-4383-9ce5-da876bb5386b', 'order', 5440.00, '65ad992a-770c-4ec2-95bb-feaa4ea81806', 'O-38', NULL, '2026-04-02 03:21:19.516126+00', NULL, NULL, NULL, NULL, NULL),
	('20aa9d05-73cf-4fbe-9938-f16e58b7d633', '838f5c75-7728-4383-9ce5-da876bb5386b', 'adjustment', 54.00, '65ad992a-770c-4ec2-95bb-feaa4ea81806', 'O-38', 'Reversal of recorded payment', '2026-04-02 03:22:13.03762+00', NULL, NULL, NULL, NULL, NULL),
	('2fdfccd7-f7d2-499f-bccc-c8b10d0867be', '838f5c75-7728-4383-9ce5-da876bb5386b', 'adjustment', 45.00, '65ad992a-770c-4ec2-95bb-feaa4ea81806', 'O-38', 'Reversal of recorded payment', '2026-04-02 03:22:13.263404+00', NULL, NULL, NULL, NULL, NULL),
	('2819f278-d415-4234-8e75-bf2b36ad4ead', '838f5c75-7728-4383-9ce5-da876bb5386b', 'adjustment', 100.00, '65ad992a-770c-4ec2-95bb-feaa4ea81806', 'O-38', 'Reversal of recorded payment', '2026-04-02 03:22:13.486326+00', NULL, NULL, NULL, NULL, NULL),
	('e377e14a-a9d7-4731-9bbc-22f4590d3d8f', '838f5c75-7728-4383-9ce5-da876bb5386b', 'order', 544.00, '2d662acf-740d-434b-aabc-f1fcf82515e1', 'O-39', NULL, '2026-04-02 03:35:40.542366+00', NULL, NULL, NULL, NULL, NULL),
	('552f0a76-c3cc-482f-b2e0-48b7e82ae0e6', '838f5c75-7728-4383-9ce5-da876bb5386b', 'order', -544.00, '2d662acf-740d-434b-aabc-f1fcf82515e1', 'O-39', NULL, '2026-04-02 03:35:54.260597+00', NULL, NULL, NULL, NULL, NULL),
	('40a4beba-b116-47e8-b56d-fc7f1b18ce73', NULL, 'order', 544.00, '40666a26-dfca-4b19-b22a-53096124ecbc', 'O-40', NULL, '2026-04-02 10:03:54.266786+00', NULL, NULL, NULL, NULL, NULL),
	('10fbb2e6-5ea4-41d6-a1b9-dce6086551c7', NULL, 'adjustment', -544.00, '40666a26-dfca-4b19-b22a-53096124ecbc', 'O-40', 'Cancelled walk-in order #40 (reverse sale)', '2026-04-02 10:04:19.591531+00', NULL, NULL, NULL, NULL, NULL),
	('7953fe18-0e75-4436-8b32-2d1400d1a281', NULL, 'adjustment', 544.00, '40666a26-dfca-4b19-b22a-53096124ecbc', 'O-40', 'Cancelled walk-in order #40 (reverse payment)', '2026-04-02 10:04:19.698965+00', NULL, NULL, NULL, NULL, NULL),
	('9e89bd2f-329d-451f-9ce4-d3789e9a3330', NULL, 'adjustment', 54.00, '338b175f-c2f3-4074-9d9d-0fdd7fa9418c', 'O-41', 'Reversal of recorded payment', '2026-04-02 10:10:11.391705+00', NULL, NULL, NULL, NULL, NULL),
	('2646caf2-b12c-4562-9442-4747d16912ef', NULL, 'adjustment', 490.00, '338b175f-c2f3-4074-9d9d-0fdd7fa9418c', 'O-41', 'Reversal of recorded payment', '2026-04-02 10:10:11.501593+00', NULL, NULL, NULL, NULL, NULL),
	('98187772-4bbb-4daf-9447-da1198001a81', NULL, 'adjustment', -544.00, '338b175f-c2f3-4074-9d9d-0fdd7fa9418c', 'O-41', 'Reversal of recorded payment', '2026-04-02 10:10:12.073308+00', NULL, NULL, NULL, NULL, NULL),
	('d513675a-1e0f-4a8f-b3b7-640577536806', NULL, 'order', 544.00, '338b175f-c2f3-4074-9d9d-0fdd7fa9418c', 'O-41', NULL, '2026-04-02 10:09:55.820382+00', NULL, NULL, NULL, '2026-04-02 10:10:12.094+00', NULL),
	('ff3d4950-7b0d-44c2-a257-0e0b7b9bb285', '355ddf91-4d5a-4c80-bd3a-3c1e6cdfbb2c', 'purchase_order', -334.00, 'e4d256fe-13f7-4b70-99dd-3be672d55c61', 'PO-23', NULL, '2026-04-02 10:11:36.723626+00', NULL, NULL, NULL, NULL, NULL),
	('dca9d6ac-48d8-4919-9c50-a351a14e983e', '355ddf91-4d5a-4c80-bd3a-3c1e6cdfbb2c', 'adjustment', -44.00, 'e4d256fe-13f7-4b70-99dd-3be672d55c61', 'PO-23', 'Reversal of recorded payment', '2026-04-02 10:12:09.265987+00', NULL, NULL, NULL, NULL, NULL),
	('7944b130-84e8-4c7f-8371-0313f69d86bf', '355ddf91-4d5a-4c80-bd3a-3c1e6cdfbb2c', 'purchase_order', 334.00, 'e4d256fe-13f7-4b70-99dd-3be672d55c61', 'PO-23', NULL, '2026-04-02 10:12:10.016454+00', NULL, NULL, NULL, NULL, NULL),
	('24ec7f78-bae9-4af2-a9f5-f51b176584ab', '355ddf91-4d5a-4c80-bd3a-3c1e6cdfbb2c', 'adjustment', -50.00, 'af494e57-ebe9-4941-a45b-b14a02aa53af', 'PO-24', 'Reversal of recorded payment', '2026-04-02 10:27:45.287196+00', NULL, NULL, NULL, NULL, NULL),
	('8003a87d-54d6-45c9-8dd6-9ab845947d36', '355ddf91-4d5a-4c80-bd3a-3c1e6cdfbb2c', 'adjustment', -50.00, 'af494e57-ebe9-4941-a45b-b14a02aa53af', 'PO-24', 'Reversal of recorded payment', '2026-04-02 10:27:45.406058+00', NULL, NULL, NULL, NULL, NULL),
	('4a4913c1-61c4-4c77-a103-0c0ec91868db', '355ddf91-4d5a-4c80-bd3a-3c1e6cdfbb2c', 'purchase_order', -334.00, 'af494e57-ebe9-4941-a45b-b14a02aa53af', 'PO-24', NULL, '2026-04-02 10:27:25.027152+00', NULL, NULL, NULL, '2026-04-02 10:27:46.261+00', NULL),
	('1e1bae3a-706d-4cf4-8f30-151ef091d722', '355ddf91-4d5a-4c80-bd3a-3c1e6cdfbb2c', 'payment_in', -200.00, NULL, 'PI-5', NULL, '2026-04-02 01:49:56.778359+00', 'cash', NULL, NULL, '2026-04-02 01:50:11.772+00', 1),
	('b081288f-4f03-43cd-9756-3167924374fe', NULL, 'adjustment', -544.00, '4b687a20-9b84-44c0-97ea-3de9f6d43e37', 'O-57', 'Reversal of recorded payment', '2026-04-08 02:46:52.692771+00', NULL, NULL, NULL, NULL, NULL),
	('b3b70e83-f1e4-4d40-842e-038cc9d461c9', '838f5c75-7728-4383-9ce5-da876bb5386b', 'adjustment', 40.00, '730094e4-acde-4f04-b75d-98be180f2d66', 'O-55', 'Reversal of recorded payment', '2026-04-08 02:47:38.149735+00', NULL, NULL, NULL, NULL, NULL),
	('8ca74917-8fbc-40f0-8195-b2c1af75e7e1', '355ddf91-4d5a-4c80-bd3a-3c1e6cdfbb2c', 'adjustment', 334.00, 'af494e57-ebe9-4941-a45b-b14a02aa53af', 'PO-24', 'Reversal of recorded payment', '2026-04-02 10:27:46.245023+00', NULL, NULL, NULL, NULL, NULL),
	('29a6b08c-ae50-4212-b042-adccd12f7e4e', '838f5c75-7728-4383-9ce5-da876bb5386b', 'payment_out', 35.00, '1f295127-ef94-4387-968b-46618631c31c', 'PO-35', 'Payment at purchase order', '2026-04-08 03:24:42.723462+00', 'cheque', NULL, NULL, NULL, 1),
	('e8c07603-c3a6-4dd7-a8a4-41e4c63cf95c', '838f5c75-7728-4383-9ce5-da876bb5386b', 'adjustment', 100.00, 'a95c140f-32fa-4b76-96aa-5728a190406a', 'O-42', 'Reversal of recorded payment', '2026-04-02 10:30:00.839264+00', NULL, NULL, NULL, NULL, NULL),
	('d602b9bc-96e8-444f-a5bd-fe6d8742f667', '838f5c75-7728-4383-9ce5-da876bb5386b', 'adjustment', -544.00, 'a95c140f-32fa-4b76-96aa-5728a190406a', 'O-42', 'Reversal of recorded payment', '2026-04-02 10:30:01.642028+00', NULL, NULL, NULL, NULL, NULL),
	('5f8aa35f-4dd6-41fd-b9e2-f4e16b8d8c75', '838f5c75-7728-4383-9ce5-da876bb5386b', 'order', 544.00, 'a95c140f-32fa-4b76-96aa-5728a190406a', 'O-42', NULL, '2026-04-02 10:29:45.842162+00', NULL, NULL, NULL, '2026-04-02 10:30:01.659+00', NULL),
	('f9cd4736-8f80-405b-a407-f18bd6a5632c', '838f5c75-7728-4383-9ce5-da876bb5386b', 'adjustment', 70.00, '101ed81f-d220-434a-a216-d2aeeb8a395a', 'O-43', 'Reversal of recorded payment', '2026-04-02 19:10:32.935487+00', NULL, NULL, NULL, NULL, NULL),
	('d4efee46-d2df-427c-8125-af7c88dcb3e1', '838f5c75-7728-4383-9ce5-da876bb5386b', 'adjustment', -544.00, '101ed81f-d220-434a-a216-d2aeeb8a395a', 'O-43', 'Reversal of recorded payment', '2026-04-02 19:10:33.738938+00', NULL, NULL, NULL, NULL, NULL),
	('ee555983-6c85-4e76-b46c-3b3a960bf838', '838f5c75-7728-4383-9ce5-da876bb5386b', 'order', 544.00, '101ed81f-d220-434a-a216-d2aeeb8a395a', 'O-43', NULL, '2026-04-02 19:09:52.105157+00', NULL, NULL, NULL, '2026-04-02 19:10:33.805+00', NULL),
	('29aac06d-9f0c-4f39-a72f-1f8c4be866bd', '838f5c75-7728-4383-9ce5-da876bb5386b', 'adjustment', -56.00, '2c133408-64ad-4fc1-a02c-5d4993b3aefb', 'PO-25', 'Reversal of recorded payment', '2026-04-02 19:24:24.324877+00', NULL, NULL, NULL, NULL, NULL),
	('8676ea4f-b6fd-4b7a-b293-cd088b2994d7', '838f5c75-7728-4383-9ce5-da876bb5386b', 'adjustment', 334.00, '2c133408-64ad-4fc1-a02c-5d4993b3aefb', 'PO-25', 'Reversal of recorded payment', '2026-04-02 19:24:25.281123+00', NULL, NULL, NULL, NULL, NULL),
	('7c1bdb51-31a2-4747-9823-a95170ef2126', '838f5c75-7728-4383-9ce5-da876bb5386b', 'purchase_order', -334.00, '2c133408-64ad-4fc1-a02c-5d4993b3aefb', 'PO-25', NULL, '2026-04-02 19:24:02.84869+00', NULL, NULL, NULL, '2026-04-02 19:24:25.393+00', NULL),
	('617b3f16-f438-4da3-aa1b-55a2ed7775da', '838f5c75-7728-4383-9ce5-da876bb5386b', 'adjustment', 455.00, 'a539c1fc-561d-4c55-8f7c-65a7e89bd43b', 'O-44', 'Reversal of recorded payment', '2026-04-02 19:25:37.17631+00', NULL, NULL, NULL, NULL, NULL),
	('32f9184a-d3c6-4d06-afcd-46d11a023cb0', '838f5c75-7728-4383-9ce5-da876bb5386b', 'adjustment', -544.00, 'a539c1fc-561d-4c55-8f7c-65a7e89bd43b', 'O-44', 'Reversal of recorded payment', '2026-04-02 19:25:37.964019+00', NULL, NULL, NULL, NULL, NULL),
	('3eca4b5a-2280-4323-a08d-b5bbb48672e6', '838f5c75-7728-4383-9ce5-da876bb5386b', 'order', 544.00, 'a539c1fc-561d-4c55-8f7c-65a7e89bd43b', 'O-44', NULL, '2026-04-02 19:25:21.769549+00', NULL, NULL, NULL, '2026-04-02 19:25:38.002+00', NULL),
	('e98577c9-b0d3-41be-bda2-fc0d4748a8c5', '838f5c75-7728-4383-9ce5-da876bb5386b', 'adjustment', 45.00, 'd301035b-1b48-4f7a-90fb-88a0e2e3070c', 'O-45', 'Reversal of recorded payment', '2026-04-02 19:35:10.1811+00', NULL, NULL, NULL, NULL, NULL),
	('12523bed-7d00-462f-8d66-e6b84855357e', '838f5c75-7728-4383-9ce5-da876bb5386b', 'adjustment', -544.00, 'd301035b-1b48-4f7a-90fb-88a0e2e3070c', 'O-45', 'Reversal of recorded payment', '2026-04-02 19:35:11.003184+00', NULL, NULL, NULL, NULL, NULL),
	('2b9c0b3d-8b05-411a-8df0-4a5ac84f40df', '838f5c75-7728-4383-9ce5-da876bb5386b', 'order', 544.00, 'd301035b-1b48-4f7a-90fb-88a0e2e3070c', 'O-45', NULL, '2026-04-02 19:34:55.90443+00', NULL, NULL, NULL, '2026-04-02 19:35:11.022+00', NULL),
	('55895d78-2379-4fd8-9dd5-22aa45db0650', '838f5c75-7728-4383-9ce5-da876bb5386b', 'adjustment', 544.00, '2658f5ce-51d2-44df-834b-9b2065547dd5', 'O-46', 'Reversal of recorded payment', '2026-04-02 19:59:14.404691+00', NULL, NULL, NULL, NULL, NULL),
	('1bf87094-efc8-493f-8b65-735911bdf736', '838f5c75-7728-4383-9ce5-da876bb5386b', 'adjustment', -544.00, '2658f5ce-51d2-44df-834b-9b2065547dd5', 'O-46', 'Reversal of recorded payment', '2026-04-02 19:59:15.243102+00', NULL, NULL, NULL, NULL, NULL),
	('52352289-b02a-4fab-b0c2-7288b8def3a0', '838f5c75-7728-4383-9ce5-da876bb5386b', 'order', 544.00, '2658f5ce-51d2-44df-834b-9b2065547dd5', 'O-46', NULL, '2026-04-02 19:58:48.00822+00', NULL, NULL, NULL, '2026-04-02 19:59:15.338+00', NULL),
	('10904909-ee04-481e-9597-21727090ea34', '838f5c75-7728-4383-9ce5-da876bb5386b', 'adjustment', 46.00, 'eef3675a-9783-4526-a383-fa1956cff02c', 'O-47', 'Reversal of recorded payment', '2026-04-02 20:01:34.496503+00', NULL, NULL, NULL, NULL, NULL),
	('b3bb7145-3c84-408c-8442-4223fe114ebb', '838f5c75-7728-4383-9ce5-da876bb5386b', 'adjustment', -544.00, 'eef3675a-9783-4526-a383-fa1956cff02c', 'O-47', 'Reversal of recorded payment', '2026-04-02 20:01:35.336664+00', NULL, NULL, NULL, NULL, NULL),
	('cae77270-ed13-4a39-973c-08f93b61f08a', '838f5c75-7728-4383-9ce5-da876bb5386b', 'order', 544.00, 'eef3675a-9783-4526-a383-fa1956cff02c', 'O-47', NULL, '2026-04-02 20:01:18.850118+00', NULL, NULL, NULL, '2026-04-02 20:01:35.423+00', NULL),
	('ff74410b-59cd-4140-8f39-f104dc7d3193', '838f5c75-7728-4383-9ce5-da876bb5386b', 'adjustment', 46.00, 'daa5b08c-d9f5-4deb-9074-02cb7c24ed83', NULL, 'Reversal of recorded payment', '2026-04-02 20:02:36.529945+00', NULL, NULL, NULL, NULL, NULL),
	('e478e4e0-2904-4bb0-a4d0-9accd2beffc5', '355ddf91-4d5a-4c80-bd3a-3c1e6cdfbb2c', 'adjustment', 76.00, '6907620f-d613-4325-889b-496aa923367b', 'PI-8', 'Reversal of recorded payment', '2026-04-02 20:03:43.491129+00', NULL, NULL, NULL, NULL, NULL),
	('4ba6cc1a-f2de-4878-a9bd-80797fa5a7f6', '838f5c75-7728-4383-9ce5-da876bb5386b', 'adjustment', 45.00, '1f3ec53c-8b0f-4d27-8a2d-90f449263b35', 'O-48', 'Reversal of recorded payment', '2026-04-02 20:16:39.008306+00', NULL, NULL, NULL, NULL, NULL),
	('2eb1c42b-2ff5-4a41-9704-59309689bddc', '838f5c75-7728-4383-9ce5-da876bb5386b', 'adjustment', -544.00, '1f3ec53c-8b0f-4d27-8a2d-90f449263b35', 'O-48', 'Reversal of recorded payment', '2026-04-02 20:16:39.791899+00', NULL, NULL, NULL, NULL, NULL),
	('d9fa47c4-f9c3-4635-bc51-e1de76cbc3c2', '838f5c75-7728-4383-9ce5-da876bb5386b', 'order', 544.00, '1f3ec53c-8b0f-4d27-8a2d-90f449263b35', 'O-48', NULL, '2026-04-02 20:16:22.929981+00', NULL, NULL, NULL, '2026-04-02 20:16:39.812+00', NULL),
	('25899161-66a5-44f7-928a-a8ee3e0a0592', '838f5c75-7728-4383-9ce5-da876bb5386b', 'adjustment', 45.00, 'b480cde7-db1a-4a1d-8019-d436c3c9d73a', 'PI-9', 'Reversal of recorded payment', '2026-04-02 20:17:01.662886+00', NULL, NULL, NULL, NULL, NULL),
	('360d586f-f9fb-4232-93f9-b72c2883a20f', '355ddf91-4d5a-4c80-bd3a-3c1e6cdfbb2c', 'adjustment', -54.00, '9d4fd136-20a3-4491-aafb-eb9c73951681', 'PO-26', 'Reversal of recorded payment', '2026-04-03 17:18:02.21061+00', NULL, NULL, NULL, NULL, NULL),
	('cee6c59a-9ed7-4766-a82e-130f92587196', '355ddf91-4d5a-4c80-bd3a-3c1e6cdfbb2c', 'adjustment', 334.00, '9d4fd136-20a3-4491-aafb-eb9c73951681', 'PO-26', 'Reversal of recorded payment', '2026-04-03 17:18:03.100589+00', NULL, NULL, NULL, NULL, NULL),
	('5cad2344-1c27-4cc7-9075-1209e6b587ba', '355ddf91-4d5a-4c80-bd3a-3c1e6cdfbb2c', 'purchase_order', -334.00, '9d4fd136-20a3-4491-aafb-eb9c73951681', 'PO-26', NULL, '2026-04-03 17:17:42.995115+00', NULL, NULL, NULL, '2026-04-03 17:18:02.973+00', NULL),
	('f355ee88-b19f-4bd0-9cea-fdd2c8587e0d', '355ddf91-4d5a-4c80-bd3a-3c1e6cdfbb2c', 'adjustment', -54.00, 'cde73149-dc11-4ee5-9358-c9249530d123', 'PY-2', 'Reversal of recorded payment', '2026-04-03 17:18:22.382068+00', NULL, NULL, NULL, NULL, NULL),
	('23662f26-b57d-475f-a097-22138bc56825', '355ddf91-4d5a-4c80-bd3a-3c1e6cdfbb2c', 'purchase_order', -41284.00, 'f0685503-af68-41ce-8592-64f93c011521', 'PO-27', NULL, '2026-04-03 17:48:00.430105+00', NULL, NULL, NULL, NULL, NULL),
	('28db801f-5320-4ae2-b88e-4cba3b8d288d', '838f5c75-7728-4383-9ce5-da876bb5386b', 'adjustment', 60.00, '730094e4-acde-4f04-b75d-98be180f2d66', 'O-55', 'Reversal of recorded payment', '2026-04-08 02:47:38.024788+00', NULL, NULL, NULL, NULL, NULL),
	('a9d84c8e-9358-4616-8a8d-3e80cbb32893', '838f5c75-7728-4383-9ce5-da876bb5386b', 'order', 544.00, '730094e4-acde-4f04-b75d-98be180f2d66', 'O-55', NULL, '2026-04-07 20:15:20.078295+00', NULL, NULL, NULL, '2026-04-08 02:47:39.165+00', NULL),
	('cda05e28-8e8e-41e3-96da-b58986af5bbc', '72b6d4eb-cef2-4c84-9968-9f8f0c40a076', 'adjustment', -120.00, NULL, NULL, 'CSV import opening balance', '2026-04-09 02:14:19.18355+00', NULL, NULL, NULL, NULL, NULL),
	('b9dd1769-2bb3-4a88-a5e3-18d1692061bc', NULL, 'order', 544.00, '8cd2a495-515c-4eb6-9246-c5ab84a6f5a3', 'O-49', NULL, '2026-04-03 18:23:49.579449+00', NULL, NULL, NULL, NULL, NULL),
	('91e8260b-e174-4bed-a537-d8320a0586b8', NULL, 'adjustment', -1255.00, 'da11da89-41f2-4fd0-8499-4afc6cbb1a35', 'REG-MNJ911XV-B61538', 'Reversal of recorded payment', '2026-04-03 18:40:36.553855+00', NULL, NULL, NULL, NULL, NULL),
	('96bbd0a9-8d8c-4373-859b-d6c8b4e9fe87', '355ddf91-4d5a-4c80-bd3a-3c1e6cdfbb2c', 'purchase_order', -334.00, '1d7ec987-038d-4cb5-89e3-5059dcf7410a', 'PO-28', NULL, '2026-04-03 20:19:55.681461+00', NULL, NULL, NULL, NULL, NULL),
	('242ca804-16af-4adb-97ab-35f802f40943', NULL, 'order', 544.00, 'ca755135-040a-4c66-bf92-05549232ea6b', 'O-50', NULL, '2026-04-03 20:21:41.743524+00', NULL, NULL, NULL, NULL, NULL),
	('c6da53fb-e753-40c8-b9b9-fc1c43df8a36', '91810f5e-4dbe-4126-ba9b-e21fc12f41cf', 'order', 4896.00, '5b21ce4e-42c4-4c09-bc4e-e7336f064a66', 'O-51', NULL, '2026-04-03 22:13:42.206657+00', NULL, NULL, NULL, NULL, NULL),
	('1d19ac03-3da5-4fbe-81b6-1841b6d5ccd2', '838f5c75-7728-4383-9ce5-da876bb5386b', 'order', 544.00, '29582a30-7354-4830-809f-c5472e9319aa', 'O-52', NULL, '2026-04-03 23:21:14.944914+00', NULL, NULL, NULL, NULL, NULL),
	('fb0c0012-5964-4576-9b95-99704592cadc', NULL, 'order', 5175.00, '7569308c-b7c6-4d9f-80fa-c150b620798a', 'O-53', NULL, '2026-04-04 13:55:28.296531+00', NULL, NULL, NULL, NULL, NULL),
	('02e89214-6a99-4225-9e33-284f2d032a18', '838f5c75-7728-4383-9ce5-da876bb5386b', 'purchase_order', -690.00, 'bd1df1b4-17c5-450b-8ddf-2bd8c771adcc', 'PO-29', NULL, '2026-04-04 16:04:15.510858+00', NULL, NULL, NULL, NULL, NULL),
	('529a50a0-9f76-4619-abad-b515ce9de455', '838f5c75-7728-4383-9ce5-da876bb5386b', 'purchase_order', -384.00, 'b92c96c3-f7a1-47f1-902c-ba45894e14a6', 'PO-30', NULL, '2026-04-04 16:05:49.174987+00', NULL, NULL, NULL, NULL, NULL),
	('d3f0b5f1-198c-477d-8ce4-f7ca7f2693ec', '838f5c75-7728-4383-9ce5-da876bb5386b', 'purchase_order', -330.00, 'df606274-1c6f-433e-b845-1c9d375ac812', 'PO-31', NULL, '2026-04-04 23:13:59.751034+00', NULL, NULL, NULL, NULL, NULL),
	('57737ed9-5922-4442-9d4e-0c06932c6d4b', '838f5c75-7728-4383-9ce5-da876bb5386b', 'purchase_order', -70.00, '7e3aa601-7989-4685-8cd5-79cd59c0fd68', 'PO-32', NULL, '2026-04-04 23:15:37.64924+00', NULL, NULL, NULL, NULL, NULL),
	('49f93e39-e742-4e7e-bf8b-9f0b2202ea5c', '355ddf91-4d5a-4c80-bd3a-3c1e6cdfbb2c', 'purchase_order', -1057.00, '6c61c713-616d-4f8c-a776-7be1273a1b4b', 'PO-33', NULL, '2026-04-04 23:24:03.975191+00', NULL, NULL, NULL, NULL, NULL),
	('bf317c1b-2182-4eaf-bedb-4f254178441a', '838f5c75-7728-4383-9ce5-da876bb5386b', 'adjustment', 45.00, '0c9183c4-9d0e-48bc-949f-da42edecd089', 'O-54', 'Reversal of recorded payment', '2026-04-07 20:13:18.095316+00', NULL, NULL, NULL, NULL, NULL),
	('ce1e877b-741a-4cdd-8b5d-02543315958e', '838f5c75-7728-4383-9ce5-da876bb5386b', 'adjustment', 45.00, '0c9183c4-9d0e-48bc-949f-da42edecd089', 'O-54', 'Reversal of recorded payment', '2026-04-07 20:13:18.533841+00', NULL, NULL, NULL, NULL, NULL),
	('b41ed2c2-c091-4f07-a5e5-06926589dac6', '838f5c75-7728-4383-9ce5-da876bb5386b', 'adjustment', -544.00, '0c9183c4-9d0e-48bc-949f-da42edecd089', 'O-54', 'Reversal of recorded payment', '2026-04-07 20:13:19.761211+00', NULL, NULL, NULL, NULL, NULL),
	('716f45fc-4594-42a4-85c4-3df49342897e', '838f5c75-7728-4383-9ce5-da876bb5386b', 'order', 544.00, '0c9183c4-9d0e-48bc-949f-da42edecd089', 'O-54', NULL, '2026-04-07 20:12:03.619141+00', NULL, NULL, NULL, '2026-04-07 20:13:19.893+00', NULL),
	('db763175-86fd-4d0e-b276-1ee9a0661944', '838f5c75-7728-4383-9ce5-da876bb5386b', 'purchase_order', -1050.00, 'bbda493e-f94e-4969-99c1-dd5775d32ccd', 'PO-34', NULL, '2026-04-07 22:51:18.606205+00', NULL, NULL, NULL, NULL, NULL),
	('b68fbca0-75c3-454e-9c90-8817bbce92c5', '91810f5e-4dbe-4126-ba9b-e21fc12f41cf', 'order', 544.00, 'b8b86194-5549-4454-8ed0-fcc29265a463', 'O-56', NULL, '2026-04-07 22:51:48.685934+00', NULL, NULL, NULL, NULL, NULL),
	('57f0f011-aac1-4b0e-93d0-3f20f9c5c354', '838f5c75-7728-4383-9ce5-da876bb5386b', 'payment_in', -88.00, '2aec1109-d9b7-433a-8106-22ad13090685', '10', 'Payment at confirmation', '2026-03-28 23:52:58.036332+00', NULL, NULL, NULL, NULL, 1),
	('9a595dea-ac9a-41aa-b846-fd328cdd66c5', '838f5c75-7728-4383-9ce5-da876bb5386b', 'payment_in', -134.00, '1fba40f7-6193-4f3e-91c7-ab141e109f43', '11', 'Payment at confirmation', '2026-03-29 00:29:07.136714+00', NULL, NULL, NULL, NULL, 1),
	('fd8e356d-dff0-4083-b3ff-ad60fc2b967f', '838f5c75-7728-4383-9ce5-da876bb5386b', 'payment_in', -544.00, 'a48a508a-7239-4e6b-a43f-3fcd4c9a92cd', '13', 'Payment at confirmation', '2026-03-29 00:55:01.237987+00', NULL, NULL, NULL, NULL, 1),
	('6e987cab-6ecc-4032-94b3-af525f12804e', '838f5c75-7728-4383-9ce5-da876bb5386b', 'payment_out', 6000.00, NULL, NULL, NULL, '2026-03-30 01:46:26.715931+00', NULL, NULL, NULL, NULL, 1),
	('a4f6f949-6563-4ca3-ba57-9f92b81e8602', '838f5c75-7728-4383-9ce5-da876bb5386b', 'payment_in', -34333.00, NULL, NULL, NULL, '2026-03-30 01:46:52.707292+00', NULL, NULL, NULL, NULL, 1),
	('d829b307-5a27-4d1c-8fb3-b823917ab52f', '838f5c75-7728-4383-9ce5-da876bb5386b', 'payment_in', -45.00, '2d9e8bf7-ed2f-44c3-96b5-1e707ce8f156', '15', 'Order payment', '2026-03-30 01:47:23.825617+00', NULL, NULL, NULL, NULL, 1),
	('41af6714-dde3-401e-bc83-799945482b84', '838f5c75-7728-4383-9ce5-da876bb5386b', 'payment_out', 1000.00, NULL, NULL, '1/3', '2026-03-31 20:16:27.340279+00', NULL, NULL, NULL, NULL, 1),
	('6ced5133-65ee-4975-bb9b-add6059f2571', '838f5c75-7728-4383-9ce5-da876bb5386b', 'payment_out', 1000.00, NULL, NULL, '2/3', '2026-03-31 20:16:27.340279+00', NULL, NULL, NULL, NULL, 1),
	('a7cccb49-baa1-4bae-8375-714db357c88c', '838f5c75-7728-4383-9ce5-da876bb5386b', 'payment_out', 1000.00, NULL, NULL, '3/3', '2026-03-31 20:16:27.340279+00', NULL, NULL, NULL, NULL, 1),
	('3acd51a7-9476-4d9d-9dad-504a5646fcc6', '838f5c75-7728-4383-9ce5-da876bb5386b', 'payment_out', 99.94, NULL, NULL, NULL, '2026-03-31 20:21:09.312912+00', NULL, NULL, NULL, NULL, 1),
	('7f1bc70f-5b6f-416d-beb9-cebbb19cf016', '838f5c75-7728-4383-9ce5-da876bb5386b', 'payment_out', 16000.00, NULL, NULL, NULL, '2026-03-31 20:28:14.325061+00', NULL, NULL, NULL, NULL, 1),
	('340a2d76-1b2e-4703-af66-9d42e50d1b2a', '838f5c75-7728-4383-9ce5-da876bb5386b', 'payment_out', 100.00, NULL, NULL, '1/4', '2026-03-31 20:35:52.790773+00', NULL, NULL, NULL, NULL, 1),
	('bb671f9d-02bc-442a-8f2e-620408a8cd7a', '838f5c75-7728-4383-9ce5-da876bb5386b', 'payment_out', 100.00, NULL, NULL, '2/4', '2026-03-31 20:35:52.790773+00', NULL, NULL, NULL, NULL, 1),
	('c85fd962-32b2-498e-9f0b-ab6d2646e107', '838f5c75-7728-4383-9ce5-da876bb5386b', 'payment_out', 100.00, NULL, NULL, '3/4', '2026-03-31 20:35:52.790773+00', NULL, NULL, NULL, NULL, 1),
	('e50095b9-5c6a-444f-99f7-0c6e36c299dc', NULL, 'register_withdraw', 108.00, NULL, 'REG-MNJ8E0LF-1BC551', NULL, '2026-04-03 18:22:32.177517+00', 'cheque', NULL, NULL, NULL, 1),
	('b19ff654-45f1-47c9-a04d-738d070dfaf9', NULL, 'register_withdraw', 484.00, NULL, 'REG-MNJ8E76R-CBE0B1', NULL, '2026-04-03 18:22:40.782957+00', 'instapay', NULL, NULL, NULL, 1),
	('8d30e702-d9c8-4b0e-bc64-c19f839dd769', NULL, 'register_withdraw', 7106.00, NULL, 'REG-MNJ8ER5D-BD960B', NULL, '2026-04-03 18:23:06.669186+00', 'visa', NULL, NULL, NULL, 1),
	('51f585e0-d504-4869-bee6-fac03b0cc0ef', NULL, 'register_withdraw', 5890.19, NULL, 'REG-MNJ8F3IL-BF4996', NULL, '2026-04-03 18:23:22.660677+00', 'cash', NULL, NULL, NULL, 1),
	('0a07246c-993f-4a82-a85a-8c219e10bb48', '838f5c75-7728-4383-9ce5-da876bb5386b', 'payment_out', 100.00, NULL, NULL, '4/4', '2026-03-31 20:35:52.790773+00', NULL, NULL, NULL, NULL, 1),
	('8eaebde1-146c-4c21-9962-af1dac3553ec', '838f5c75-7728-4383-9ce5-da876bb5386b', 'payment_out', 11.00, NULL, NULL, NULL, '2026-03-31 20:41:03.948219+00', NULL, NULL, NULL, NULL, 1),
	('2d20e406-eca6-4123-adb0-1339441d61e9', '838f5c75-7728-4383-9ce5-da876bb5386b', 'payment_out', 100.00, NULL, NULL, NULL, '2026-03-31 20:55:00.582368+00', NULL, NULL, NULL, NULL, 1),
	('af5919e6-ad75-4262-91b7-c16d6cc87d78', '838f5c75-7728-4383-9ce5-da876bb5386b', 'payment_in', -1000.00, NULL, NULL, NULL, '2026-03-31 21:37:15.245019+00', NULL, NULL, NULL, NULL, 1),
	('71f4b8e6-9179-4d63-b3f4-bf3224f3c58d', '355ddf91-4d5a-4c80-bd3a-3c1e6cdfbb2c', 'payment_out', 90.00, NULL, NULL, NULL, '2026-03-31 21:57:03.979267+00', NULL, NULL, NULL, NULL, 1),
	('d2392db9-14a1-46cf-b258-2bf361a4860e', '838f5c75-7728-4383-9ce5-da876bb5386b', 'adjustment', -544.00, '730094e4-acde-4f04-b75d-98be180f2d66', 'O-55', 'Reversal of recorded payment', '2026-04-08 02:47:39.148827+00', NULL, NULL, NULL, NULL, NULL),
	('8c0b391c-efe7-4565-9155-da5fb30bbd3c', '355ddf91-4d5a-4c80-bd3a-3c1e6cdfbb2c', 'payment_out', 89.00, NULL, NULL, '1/2', '2026-03-31 22:08:10.612274+00', NULL, NULL, NULL, NULL, 1),
	('e5bc3c85-25a3-4736-84f4-516673db82ee', '355ddf91-4d5a-4c80-bd3a-3c1e6cdfbb2c', 'payment_out', 100.00, NULL, NULL, '2/2', '2026-03-31 22:08:10.612274+00', NULL, NULL, NULL, NULL, 1),
	('7f70613c-3e2a-46b7-ad3a-c4d93db61169', '838f5c75-7728-4383-9ce5-da876bb5386b', 'payment_in', -10.00, 'c45005fd-e17c-41a4-b720-ed7d4a78d332', '19', 'Order payment', '2026-03-31 22:14:52.686746+00', NULL, NULL, NULL, NULL, 1),
	('8082af01-9122-4a71-a154-92c05ca65f3d', '838f5c75-7728-4383-9ce5-da876bb5386b', 'payment_in', -10.00, '3db56bd1-2707-4759-afc5-2c81dd0545c4', '20', 'Order payment', '2026-03-31 22:29:55.822135+00', NULL, NULL, NULL, NULL, 1),
	('76bbf1d5-199d-4f01-992c-ffe9b1ff145a', '838f5c75-7728-4383-9ce5-da876bb5386b', 'payment_in', -10.00, '3db56bd1-2707-4759-afc5-2c81dd0545c4', '20', 'Order payment', '2026-03-31 22:29:56.278901+00', NULL, NULL, NULL, NULL, 1),
	('e9c4432b-3342-4b05-97f7-18953bf29e58', '5b0f3cef-56d7-4f3a-973b-a15dc782210a', 'adjustment', 23.00, NULL, NULL, 'CSV import opening balance', '2026-04-09 02:14:20.407364+00', NULL, NULL, NULL, NULL, NULL),
	('b4740611-f834-4ede-804f-30f31c0bb6f3', '355ddf91-4d5a-4c80-bd3a-3c1e6cdfbb2c', 'payment_in', -105.00, NULL, NULL, NULL, '2026-03-31 22:43:33.704923+00', NULL, NULL, NULL, NULL, 1),
	('e55bcf9b-4b5f-4857-9195-cc206a56801c', '838f5c75-7728-4383-9ce5-da876bb5386b', 'payment_in', -32.00, 'fce7f76d-6937-46bb-8bc3-71002b626f4b', '21', 'Order payment', '2026-03-31 22:44:09.458765+00', NULL, NULL, NULL, NULL, 1),
	('52ee2e30-e9ab-488f-b8bc-661dbf432db1', '838f5c75-7728-4383-9ce5-da876bb5386b', 'payment_in', -23.00, 'fce7f76d-6937-46bb-8bc3-71002b626f4b', '21', 'Order payment', '2026-03-31 22:44:09.90704+00', NULL, NULL, NULL, NULL, 1),
	('e740ee30-ad35-4ce4-8362-d9dd4bc112b1', '355ddf91-4d5a-4c80-bd3a-3c1e6cdfbb2c', 'payment_out', 135.00, NULL, NULL, NULL, '2026-03-31 22:46:35.255668+00', NULL, NULL, NULL, NULL, 1),
	('7db28de2-9319-49c4-aaa2-f68dab4ccd9f', '838f5c75-7728-4383-9ce5-da876bb5386b', 'payment_in', -408.13, NULL, NULL, NULL, '2026-03-31 22:47:11.439271+00', NULL, NULL, NULL, NULL, 1),
	('3eaf6122-5d46-44a8-ad9b-ac56b555aed9', '838f5c75-7728-4383-9ce5-da876bb5386b', 'payment_in', -100.00, 'b750534c-d423-437c-8d43-2700338ce07e', '22', 'Order payment', '2026-03-31 22:47:41.293759+00', NULL, NULL, NULL, NULL, 1),
	('8e04eeef-c2e4-4d98-afe2-74041295f94a', '838f5c75-7728-4383-9ce5-da876bb5386b', 'payment_in', -100.00, 'b750534c-d423-437c-8d43-2700338ce07e', '22', 'Order payment', '2026-03-31 22:47:41.75916+00', NULL, NULL, NULL, NULL, 1),
	('2dcf1ea3-b6e3-47a9-9d4a-d7030a901264', '838f5c75-7728-4383-9ce5-da876bb5386b', 'payment_in', -200.00, '7203a5f1-d1fb-4665-abf2-21ee91086ca5', '24', 'Order payment', '2026-03-31 23:06:57.559237+00', NULL, NULL, NULL, NULL, 1),
	('df63b037-bd31-448c-bee2-a8b16222cf72', '838f5c75-7728-4383-9ce5-da876bb5386b', 'payment_in', -344.00, '7203a5f1-d1fb-4665-abf2-21ee91086ca5', '24', 'Order payment', '2026-03-31 23:06:58.242267+00', NULL, NULL, NULL, NULL, 1),
	('8820afc8-e9ba-4fc7-bccf-8402b9255284', '355ddf91-4d5a-4c80-bd3a-3c1e6cdfbb2c', 'payment_in', -45.00, NULL, NULL, '1/2', '2026-03-31 23:08:11.881318+00', NULL, NULL, NULL, NULL, 1),
	('850e6a24-fc0f-49ca-95f8-26fbe148264c', '355ddf91-4d5a-4c80-bd3a-3c1e6cdfbb2c', 'payment_in', -45.00, NULL, NULL, '2/2', '2026-03-31 23:08:11.881318+00', NULL, NULL, NULL, NULL, 1),
	('a25ac8c8-2a88-4774-8501-9365eaf225e5', '838f5c75-7728-4383-9ce5-da876bb5386b', 'payment_in', -344.00, '46baeabf-bbd9-4afa-988b-6c204dc9a253', '26', 'Order payment', '2026-03-31 23:23:56.213603+00', NULL, NULL, NULL, NULL, 1),
	('8337de49-3c8b-4cb3-9c99-f5f16cfe8706', '838f5c75-7728-4383-9ce5-da876bb5386b', 'payment_in', -44.00, '9b4cf31f-a2e0-4bbd-af84-07376f0dddfa', '27', 'Order payment', '2026-03-31 23:38:49.710311+00', 'cash', NULL, NULL, NULL, 1),
	('3499ea10-d00e-41b9-88a9-35cda6638a17', '355ddf91-4d5a-4c80-bd3a-3c1e6cdfbb2c', 'payment_out', 43.00, NULL, NULL, '1/3', '2026-03-31 23:40:28.952564+00', 'cash', '7cde8cb9-4ace-4821-8a00-ef4d08968239', NULL, NULL, 1),
	('2c34cb68-5503-4727-98ec-76699604f06d', '355ddf91-4d5a-4c80-bd3a-3c1e6cdfbb2c', 'payment_out', 34.00, NULL, NULL, '2/3', '2026-03-31 23:40:28.952564+00', 'visa', '7cde8cb9-4ace-4821-8a00-ef4d08968239', NULL, NULL, 1),
	('1bd6e4e7-ff66-4989-b949-6f96a1160f98', '355ddf91-4d5a-4c80-bd3a-3c1e6cdfbb2c', 'payment_out', 55.00, NULL, NULL, '3/3', '2026-03-31 23:40:28.952564+00', 'instapay', '7cde8cb9-4ace-4821-8a00-ef4d08968239', NULL, NULL, 1),
	('66b52a5d-44fb-434b-aea1-1d463536fa21', '355ddf91-4d5a-4c80-bd3a-3c1e6cdfbb2c', 'payment_out', 800.00, NULL, NULL, '1/2', '2026-03-31 23:50:03.759982+00', 'cash', 'df15a0bb-8af5-44b8-b4d4-314c6eeb4c81', NULL, NULL, 1),
	('af2fa028-9b8e-4f67-a469-89a0d83c4b43', '355ddf91-4d5a-4c80-bd3a-3c1e6cdfbb2c', 'payment_out', 200.00, NULL, NULL, '2/2', '2026-03-31 23:50:03.759982+00', 'visa', 'df15a0bb-8af5-44b8-b4d4-314c6eeb4c81', NULL, NULL, 1),
	('29edd402-afc9-49e4-a445-b5b095986530', NULL, 'payment_in', -544.00, 'c0f1704a-0587-41c1-8cdc-13cf41d71446', '28', 'Order payment', '2026-04-01 00:03:15.80524+00', 'cash', NULL, NULL, NULL, 1),
	('c94056f1-0268-45a1-a708-fffcd619226a', '355ddf91-4d5a-4c80-bd3a-3c1e6cdfbb2c', 'payment_in', -45.00, NULL, 'PI-1', 'canceled', '2026-04-01 22:46:26.044092+00', 'cash', 'e3ae45f1-adef-475c-a802-225a79399534', NULL, NULL, 1),
	('851e6516-ccc0-47da-9af3-4660f0f1e2ac', '355ddf91-4d5a-4c80-bd3a-3c1e6cdfbb2c', 'payment_in', -50.00, NULL, 'PI-1', 'canceled', '2026-04-01 22:46:26.044092+00', 'visa', 'e3ae45f1-adef-475c-a802-225a79399534', NULL, NULL, 1),
	('ac3ebcec-a49b-4fba-83c4-4dca2d655611', '355ddf91-4d5a-4c80-bd3a-3c1e6cdfbb2c', 'payment_in', -363.00, NULL, 'PI-2', NULL, '2026-04-02 00:01:35.684149+00', 'cash', NULL, NULL, NULL, 1),
	('3ad4231f-7a79-4a4b-9e29-71aa76cf2815', '355ddf91-4d5a-4c80-bd3a-3c1e6cdfbb2c', 'payment_in', -499.94, NULL, 'PI-3', NULL, '2026-04-02 00:08:09.112012+00', 'visa', NULL, NULL, '2026-04-02 00:18:11.883+00', 1),
	('acb424a8-c5ce-4a1c-bb61-080375ba9e14', '355ddf91-4d5a-4c80-bd3a-3c1e6cdfbb2c', 'payment_in', -100.00, NULL, 'PI-4', '1/2', '2026-04-02 00:29:10.691594+00', 'cash', '07e1ac17-434b-46aa-82c6-2dc62865b5fa', NULL, '2026-04-02 00:29:51.19+00', 1),
	('83593a37-3a3d-4b70-9eaa-a64f3f2adea9', '355ddf91-4d5a-4c80-bd3a-3c1e6cdfbb2c', 'payment_in', -999.95, NULL, 'PI-4', '2/2', '2026-04-02 00:29:10.691594+00', 'cheque', '07e1ac17-434b-46aa-82c6-2dc62865b5fa', NULL, '2026-04-02 00:29:51.19+00', 1),
	('120d60ad-d32f-4d67-87c5-76ea68eedb73', '838f5c75-7728-4383-9ce5-da876bb5386b', 'payment_in', -60.00, NULL, 'PI-11', 'Retained · O-55 — cancelled order #55 (prepaid kept on account) · doc:730094e4-acde-4f04-b75d-98be180f2d66', '2026-04-07 20:15:21.078+00', 'cash', '8a87ae7c-5ff7-4c08-8d8b-87d4f1bd11fa', NULL, NULL, 1),
	('93ed0329-37fb-46fb-a84c-29269f7bfba2', '683f6472-1f18-4244-aa3a-037a17e9ab3c', 'adjustment', 45.00, NULL, NULL, 'CSV import opening balance', '2026-04-09 02:14:21.328933+00', NULL, NULL, NULL, NULL, NULL),
	('39a6b8db-b725-43f9-9541-32905588d622', '355ddf91-4d5a-4c80-bd3a-3c1e6cdfbb2c', 'payment_out', 8887.99, NULL, 'PY-1', NULL, '2026-04-02 03:32:42.99664+00', 'cash', NULL, NULL, NULL, 1),
	('5f8864a6-7851-4ef4-b8a5-3c5a7abfd650', '355ddf91-4d5a-4c80-bd3a-3c1e6cdfbb2c', 'payment_in', -8853.99, NULL, 'PI-6', NULL, '2026-04-02 10:11:11.443442+00', 'cash', NULL, NULL, NULL, 1),
	('d98453dc-11df-4649-a2e1-5e5098321275', '838f5c75-7728-4383-9ce5-da876bb5386b', 'payment_in', -6528.00, NULL, 'PI-7', NULL, '2026-04-02 10:28:26.201378+00', 'visa', NULL, NULL, NULL, 1),
	('aa8df136-563d-44c3-afeb-79e7d6d65794', '838f5c75-7728-4383-9ce5-da876bb5386b', 'payment_in', -70.00, NULL, NULL, 'Retained from cancelled order #43', '2026-04-02 19:09:52.105157+00', 'visa', NULL, NULL, NULL, 1),
	('daa5b08c-d9f5-4deb-9074-02cb7c24ed83', '838f5c75-7728-4383-9ce5-da876bb5386b', 'payment_in', -46.00, NULL, NULL, 'Retained · O-47 — cancelled order #47 (prepaid kept on account) · doc:eef3675a-9783-4526-a383-fa1956cff02c', '2026-04-02 20:01:19.85+00', 'cash', NULL, NULL, '2026-04-02 20:02:36.547+00', 1),
	('6907620f-d613-4325-889b-496aa923367b', '355ddf91-4d5a-4c80-bd3a-3c1e6cdfbb2c', 'payment_in', -76.00, NULL, 'PI-8', NULL, '2026-04-02 20:02:52.393003+00', 'cash', NULL, NULL, '2026-04-02 20:03:43.508+00', 1),
	('b480cde7-db1a-4a1d-8019-d436c3c9d73a', '838f5c75-7728-4383-9ce5-da876bb5386b', 'payment_in', -45.00, NULL, 'PI-9', 'Retained · O-48 — cancelled order #48 (prepaid kept on account) · doc:1f3ec53c-8b0f-4d27-8a2d-90f449263b35', '2026-04-02 20:16:23.929+00', 'visa', NULL, NULL, '2026-04-02 20:17:01.687+00', 1),
	('cde73149-dc11-4ee5-9358-c9249530d123', '355ddf91-4d5a-4c80-bd3a-3c1e6cdfbb2c', 'payment_out', 54.00, NULL, 'PY-2', 'Retained · PO-26 — cancelled PO #26 (prepaid kept on account) · doc:9d4fd136-20a3-4491-aafb-eb9c73951681', '2026-04-03 17:17:43.995+00', 'cash', NULL, NULL, '2026-04-03 17:18:22.26+00', 1),
	('beff0b87-6133-4fd6-a740-6ab5ee5754bb', NULL, 'register_withdraw', 800.00, NULL, 'REG-MNJ8DTXH-885830', NULL, '2026-04-03 18:22:23.627322+00', 'cash', NULL, NULL, NULL, 1),
	('cb05ed14-3b34-49c8-ba44-eb9c3a7cafdc', NULL, 'register_deposit', 700.00, NULL, 'REG-MNJ8I46J-173A1C', NULL, '2026-04-03 18:25:43.653034+00', 'visa', NULL, NULL, NULL, 1),
	('4e1b2b95-bf1c-489b-9be8-802eedb8ce48', NULL, 'register_deposit', 455.00, NULL, 'REG-MNJ8Z0X9-100266', 'ffffddddd O-1300', '2026-04-03 18:38:52.431717+00', 'visa', NULL, NULL, NULL, 1),
	('85deda8a-48b4-404c-8b42-96929ec0e5e1', NULL, 'register_withdraw', 100.00, NULL, 'REG-MNJ90R92-90E5B2', NULL, '2026-04-03 18:40:13.134783+00', 'cash', NULL, NULL, NULL, 1),
	('da11da89-41f2-4fd0-8499-4afc6cbb1a35', NULL, 'register_withdraw', 1255.00, NULL, 'REG-MNJ911XV-B61538', NULL, '2026-04-03 18:40:26.993733+00', 'visa', NULL, NULL, '2026-04-03 18:40:36.584+00', 1),
	('cca3791f-b8d4-488e-80ee-159404172b05', '838f5c75-7728-4383-9ce5-da876bb5386b', 'payment_in', -45.00, NULL, 'PI-10', 'Retained · O-54 — cancelled order #54 (prepaid kept on account) · doc:0c9183c4-9d0e-48bc-949f-da42edecd089', '2026-04-07 20:12:04.619+00', 'cash', '1e8883b2-75f4-4038-ba90-8d2d0d6bc908', NULL, NULL, 1),
	('e26f1ca2-1b0e-4ae8-9839-cca5bd6ef0b5', '838f5c75-7728-4383-9ce5-da876bb5386b', 'payment_in', -45.00, NULL, 'PI-10', 'Retained · O-54 — cancelled order #54 (prepaid kept on account) · doc:0c9183c4-9d0e-48bc-949f-da42edecd089', '2026-04-07 20:12:04.619+00', 'visa', '1e8883b2-75f4-4038-ba90-8d2d0d6bc908', NULL, NULL, 1),
	('7ec24e1f-fb8f-4587-93e4-f8a10a721ca0', '838f5c75-7728-4383-9ce5-da876bb5386b', 'payment_out', 1578.00, NULL, 'PY-3', NULL, '2026-04-07 20:14:57.739203+00', 'cash', NULL, NULL, NULL, 1),
	('c0693ce2-8378-4a09-a2fc-207e1be188ef', '838f5c75-7728-4383-9ce5-da876bb5386b', 'payment_in', -100.00, '5067510d-8cf8-4e95-84e1-68136d1e9ae7', 'O-33', 'Order payment', '2026-04-02 01:27:48.558888+00', 'cash', NULL, NULL, NULL, 1),
	('7ef0cac3-9775-422d-bcfe-64f2ebafbbc9', '838f5c75-7728-4383-9ce5-da876bb5386b', 'payment_in', -68.00, 'fdaa4a83-19af-4420-9410-66c649612905', 'O-34', 'Order payment', '2026-04-02 01:35:07.530463+00', 'cheque', NULL, NULL, NULL, 1),
	('5a387fec-97f6-4134-8569-e583aadf7949', NULL, 'payment_in', -100.00, '8cd2a495-515c-4eb6-9246-c5ab84a6f5a3', 'O-49', 'Order payment', '2026-04-03 18:23:49.72031+00', 'cash', '1d1be3c9-5e40-4d63-823d-8f46d6c98855', NULL, NULL, 1),
	('4a679e0a-09c2-4396-ab5f-2a33ed4ae8e8', NULL, 'payment_in', -100.00, '8cd2a495-515c-4eb6-9246-c5ab84a6f5a3', 'O-49', 'Order payment', '2026-04-03 18:23:49.877049+00', 'visa', '1d1be3c9-5e40-4d63-823d-8f46d6c98855', NULL, NULL, 1),
	('a9c956c8-1f3d-4c41-aa85-a8b67579babd', NULL, 'payment_in', -544.00, '0c8182d1-244c-44c7-b8ad-a98697ad5bdd', 'O-29', 'Order payment', '2026-04-01 22:27:55.84153+00', 'visa', NULL, NULL, NULL, 1),
	('d638abb2-9a73-40e0-b617-ac2707f507df', NULL, 'payment_in', -144.00, '46002391-dd3b-4983-92cd-c6cee34a8eca', 'O-30', 'Order payment', '2026-04-01 22:29:23.054324+00', 'cash', NULL, NULL, NULL, 1),
	('061ad459-7ab0-401e-a4af-285245aa5c9c', '838f5c75-7728-4383-9ce5-da876bb5386b', 'payment_in', -100.00, '90334559-1459-4a79-beb5-01a76ad51f9d', 'O-32', 'Order payment', '2026-04-02 00:20:08.440545+00', 'cash', 'e24eec0e-302a-4408-ad45-51b18d7397d6', NULL, NULL, 1),
	('b5adb40a-b055-4d13-9537-b5af6b48086e', '838f5c75-7728-4383-9ce5-da876bb5386b', 'payment_in', -100.00, '90334559-1459-4a79-beb5-01a76ad51f9d', 'O-32', 'Order payment', '2026-04-02 00:20:08.564359+00', 'visa', 'e24eec0e-302a-4408-ad45-51b18d7397d6', NULL, NULL, 1),
	('08b20d0e-a5d8-41b9-a0d9-4576924e18da', '838f5c75-7728-4383-9ce5-da876bb5386b', 'payment_in', 68.00, 'fdaa4a83-19af-4420-9410-66c649612905', 'O-34', 'Cancelled order (reverse payment)', '2026-04-02 01:35:29.722902+00', NULL, NULL, NULL, NULL, 1),
	('16ad3c25-419f-429a-8e4d-0c915641c1e6', '838f5c75-7728-4383-9ce5-da876bb5386b', 'payment_in', -50.00, '9b4cf31f-a2e0-4bbd-af84-07376f0dddfa', 'O-27', 'Order payment', '2026-04-02 01:50:37.180866+00', 'cash', NULL, NULL, NULL, 1),
	('694ba681-9445-4392-b002-5c2a44ecb274', '838f5c75-7728-4383-9ce5-da876bb5386b', 'payment_in', 94.00, '9b4cf31f-a2e0-4bbd-af84-07376f0dddfa', 'O-27', 'Cancelled order (reverse payment)', '2026-04-02 01:51:27.257795+00', NULL, NULL, NULL, NULL, 1),
	('9402e865-e92b-4261-bc1a-ebdce110f1e4', NULL, 'payment_in', -544.00, 'abab5267-cd88-43ef-942f-54020fd5e54f', 'O-35', 'Order payment', '2026-04-02 01:52:44.451775+00', 'instapay', NULL, NULL, NULL, 1),
	('6550695c-e2de-4416-83e9-0d6038b18b0b', NULL, 'payment_in', -544.00, '92b40023-af9c-43a1-9ea7-aed1265a3259', 'O-36', 'Order payment', '2026-04-02 01:54:31.959767+00', 'cash', NULL, NULL, NULL, 1),
	('5a56f9a8-409a-4bd2-bc5e-d9a78d25c2b3', '838f5c75-7728-4383-9ce5-da876bb5386b', 'payment_in', -5.00, '164ff500-0ea5-4eb5-afd5-084b1ab48f14', 'O-37', 'Order payment', '2026-04-02 03:06:54.99742+00', 'visa', NULL, NULL, NULL, 1),
	('e1cc5ee5-f422-442e-ab49-e3d2a27b0f57', '838f5c75-7728-4383-9ce5-da876bb5386b', 'payment_in', 5.00, '164ff500-0ea5-4eb5-afd5-084b1ab48f14', 'O-37', 'Cancelled order (reverse payment)', '2026-04-02 03:08:36.209574+00', NULL, NULL, NULL, NULL, 1),
	('3f665044-30f2-424a-b67d-6ceec07b4437', '838f5c75-7728-4383-9ce5-da876bb5386b', 'payment_in', -54.00, '65ad992a-770c-4ec2-95bb-feaa4ea81806', 'O-38', 'Order payment', '2026-04-02 03:21:20.011521+00', 'cash', 'e73c4d3a-c3bc-455c-9c2a-b5def4de9fe5', NULL, '2026-04-02 03:22:13.64+00', 1),
	('d7d53787-cab8-4a08-a717-4f349e084c2c', '838f5c75-7728-4383-9ce5-da876bb5386b', 'payment_in', -45.00, '65ad992a-770c-4ec2-95bb-feaa4ea81806', 'O-38', 'Order payment', '2026-04-02 03:21:20.179125+00', 'visa', 'e73c4d3a-c3bc-455c-9c2a-b5def4de9fe5', NULL, '2026-04-02 03:22:13.64+00', 1),
	('ef80b527-3be9-4325-a9a2-453fee51a6f3', '838f5c75-7728-4383-9ce5-da876bb5386b', 'payment_in', -100.00, '65ad992a-770c-4ec2-95bb-feaa4ea81806', 'O-38', 'Order payment', '2026-04-02 03:21:20.656319+00', 'instapay', 'e73c4d3a-c3bc-455c-9c2a-b5def4de9fe5', NULL, '2026-04-02 03:22:13.64+00', 1),
	('3c3dcea3-11b3-4bcf-9076-13e939f88cdd', '838f5c75-7728-4383-9ce5-da876bb5386b', 'payment_in', -3.00, '2d662acf-740d-434b-aabc-f1fcf82515e1', 'O-39', 'Order payment', '2026-04-02 03:35:40.982949+00', 'visa', '4a509e27-c929-42cc-a091-bbc0a43df813', NULL, NULL, 1),
	('2ac6fa4d-3297-4f48-99d9-523ffc361a10', '838f5c75-7728-4383-9ce5-da876bb5386b', 'payment_in', -45.00, '2d662acf-740d-434b-aabc-f1fcf82515e1', 'O-39', 'Order payment', '2026-04-02 03:35:41.162083+00', 'cheque', '4a509e27-c929-42cc-a091-bbc0a43df813', NULL, NULL, 1),
	('b174d91c-6aed-487d-9707-342db4af0866', '838f5c75-7728-4383-9ce5-da876bb5386b', 'payment_in', 48.00, '2d662acf-740d-434b-aabc-f1fcf82515e1', 'O-39', 'Cancelled order (reverse payment)', '2026-04-02 03:35:54.098063+00', NULL, NULL, NULL, NULL, 1),
	('fc7435bf-2155-4a0c-8743-df4e279902da', NULL, 'payment_in', -544.00, '40666a26-dfca-4b19-b22a-53096124ecbc', 'O-40', 'Order payment', '2026-04-02 10:03:54.582321+00', 'cash', NULL, NULL, NULL, 1),
	('6e316954-442a-41ac-9490-50b584afad11', NULL, 'payment_in', -54.00, '338b175f-c2f3-4074-9d9d-0fdd7fa9418c', 'O-41', 'Order payment', '2026-04-02 10:09:55.934109+00', 'visa', '0fe83c54-428c-441e-9d15-19f0e070ed21', NULL, '2026-04-02 10:10:11.525+00', 1),
	('255338fd-359c-40bb-a7dd-114130d7d1f1', NULL, 'payment_in', -490.00, '338b175f-c2f3-4074-9d9d-0fdd7fa9418c', 'O-41', 'Order payment', '2026-04-02 10:09:56.044421+00', 'cheque', '0fe83c54-428c-441e-9d15-19f0e070ed21', NULL, '2026-04-02 10:10:11.525+00', 1),
	('aec5af06-f0cc-4a36-b32b-b6c1af7d242b', '838f5c75-7728-4383-9ce5-da876bb5386b', 'payment_in', -100.00, 'a95c140f-32fa-4b76-96aa-5728a190406a', 'O-42', 'Order payment', '2026-04-02 10:29:46.126815+00', 'cash', NULL, NULL, '2026-04-02 10:30:00.855+00', 1),
	('9adb07f0-6365-4531-a625-87f882576fe9', '838f5c75-7728-4383-9ce5-da876bb5386b', 'payment_in', -70.00, '101ed81f-d220-434a-a216-d2aeeb8a395a', 'O-43', 'Order payment', '2026-04-02 19:09:52.607386+00', 'visa', NULL, NULL, '2026-04-02 19:10:33.001+00', 1),
	('61e00a01-8e1c-422c-9269-34280d1553e6', '838f5c75-7728-4383-9ce5-da876bb5386b', 'payment_in', -455.00, 'a539c1fc-561d-4c55-8f7c-65a7e89bd43b', 'O-44', 'Order payment', '2026-04-02 19:25:22.081801+00', 'cash', NULL, NULL, '2026-04-02 19:25:37.213+00', 1),
	('dc23b9e3-b129-4700-a2f2-9e945c3c2c67', '838f5c75-7728-4383-9ce5-da876bb5386b', 'payment_in', -455.00, 'a539c1fc-561d-4c55-8f7c-65a7e89bd43b', 'O-44', 'Retained · O-44 — cancelled order #44 (prepaid kept on account)', '2026-04-02 19:25:21.769549+00', 'cash', NULL, NULL, NULL, 1),
	('07a0cb32-5d14-42e9-99e1-26672c120a8b', '838f5c75-7728-4383-9ce5-da876bb5386b', 'payment_in', -45.00, 'd301035b-1b48-4f7a-90fb-88a0e2e3070c', 'O-45', 'Order payment', '2026-04-02 19:34:56.15646+00', 'visa', NULL, NULL, '2026-04-02 19:35:10.207+00', 1),
	('7ff18377-ef95-43a2-beba-e00b7f45d0f7', '838f5c75-7728-4383-9ce5-da876bb5386b', 'payment_in', -45.00, 'd301035b-1b48-4f7a-90fb-88a0e2e3070c', 'O-45', 'Retained · O-45 — cancelled order #45 (prepaid kept on account)', '2026-04-02 19:34:55.90443+00', 'visa', NULL, NULL, NULL, 1),
	('94d795e8-b7ca-4602-ad42-efb2e601dc51', '838f5c75-7728-4383-9ce5-da876bb5386b', 'payment_in', -544.00, '2658f5ce-51d2-44df-834b-9b2065547dd5', 'O-46', 'Order payment', '2026-04-02 19:58:48.243939+00', 'cash', NULL, NULL, '2026-04-02 19:59:14.427+00', 1),
	('1b7b7c67-a5fb-421c-a21e-abc517a58e08', '838f5c75-7728-4383-9ce5-da876bb5386b', 'payment_in', -46.00, 'eef3675a-9783-4526-a383-fa1956cff02c', 'O-47', 'Order payment', '2026-04-02 20:01:19.24067+00', 'cash', NULL, NULL, '2026-04-02 20:01:34.512+00', 1),
	('50b0bbe0-b2fe-467b-a846-0f0b1d1be55c', '838f5c75-7728-4383-9ce5-da876bb5386b', 'payment_in', -45.00, '1f3ec53c-8b0f-4d27-8a2d-90f449263b35', 'O-48', 'Order payment', '2026-04-02 20:16:23.287825+00', 'visa', NULL, NULL, '2026-04-02 20:16:39.026+00', 1),
	('a51ecbb7-53fa-4940-a39d-12a2b1967c42', NULL, 'payment_in', -344.00, '8cd2a495-515c-4eb6-9246-c5ab84a6f5a3', 'O-49', 'Order payment', '2026-04-03 18:23:50.071772+00', 'cheque', '1d1be3c9-5e40-4d63-823d-8f46d6c98855', NULL, NULL, 1),
	('614d465e-ddf0-47fc-b3e7-65f50b094f6e', NULL, 'payment_in', -544.00, 'ca755135-040a-4c66-bf92-05549232ea6b', 'O-50', 'Order payment', '2026-04-03 20:21:41.888811+00', 'cash', NULL, NULL, NULL, 1),
	('e4e6a053-4e8b-4a4e-82e7-34fdf9ee5fd0', '838f5c75-7728-4383-9ce5-da876bb5386b', 'payment_in', -44.00, '29582a30-7354-4830-809f-c5472e9319aa', 'O-52', 'Order payment', '2026-04-03 23:21:15.294362+00', 'cash', NULL, NULL, NULL, 1),
	('207f3547-b165-4e54-b065-668bda868e51', NULL, 'payment_in', -5175.00, '7569308c-b7c6-4d9f-80fa-c150b620798a', 'O-53', 'Order payment', '2026-04-04 13:55:28.474534+00', 'cash', NULL, NULL, NULL, 1),
	('de2dc900-dc43-405b-a2fd-9f17135c2d26', '838f5c75-7728-4383-9ce5-da876bb5386b', 'payment_in', -45.00, '0c9183c4-9d0e-48bc-949f-da42edecd089', 'O-54', 'Order payment', '2026-04-07 20:12:04.309239+00', 'cash', 'c0f6bc7b-6503-4d48-8669-3d574fdcc37b', NULL, '2026-04-07 20:13:18.565+00', 1),
	('dcf7b5f1-5066-4897-8c6e-47d74215777e', '838f5c75-7728-4383-9ce5-da876bb5386b', 'payment_in', -45.00, '0c9183c4-9d0e-48bc-949f-da42edecd089', 'O-54', 'Order payment', '2026-04-07 20:12:04.451442+00', 'visa', 'c0f6bc7b-6503-4d48-8669-3d574fdcc37b', NULL, '2026-04-07 20:13:18.565+00', 1),
	('3ee90dc4-c20c-4cba-b78a-4211a08de937', '838f5c75-7728-4383-9ce5-da876bb5386b', 'payment_in', -40.00, NULL, 'PI-11', 'Retained · O-55 — cancelled order #55 (prepaid kept on account) · doc:730094e4-acde-4f04-b75d-98be180f2d66', '2026-04-07 20:15:21.078+00', 'visa', '8a87ae7c-5ff7-4c08-8d8b-87d4f1bd11fa', NULL, NULL, 1),
	('06d4929b-297a-45ed-9c7f-4c6580d1b370', NULL, 'order', 544.00, 'b5b31103-6df2-4614-b1d0-1e5130db5b9e', 'O-59', NULL, '2026-04-09 23:40:52.461999+00', NULL, NULL, NULL, NULL, NULL),
	('f8108cf6-8eb7-4947-945e-b5366cd1f2d8', '838f5c75-7728-4383-9ce5-da876bb5386b', 'payment_out', 5344.00, '1e9666fe-5072-42b1-b43f-5cd11b06399b', 'PO-7', 'Payment at purchase order', '2026-03-30 01:45:34.21504+00', NULL, NULL, NULL, NULL, 1),
	('26f8e7e0-f085-4180-b08c-543f568210e7', '355ddf91-4d5a-4c80-bd3a-3c1e6cdfbb2c', 'payment_out', 5.00, '858dac90-2a6a-41a4-9b28-125203cb5e99', 'PO-10', 'Payment at purchase order', '2026-03-31 22:06:36.524002+00', NULL, NULL, NULL, NULL, 1),
	('32dc4705-d539-4035-a909-6db807ef7f1f', '355ddf91-4d5a-4c80-bd3a-3c1e6cdfbb2c', 'payment_out', 334.00, '2248f779-234e-4414-a6fe-a12d81041429', 'PO-11', 'Payment at purchase order', '2026-03-31 22:31:02.538346+00', NULL, NULL, NULL, NULL, 1),
	('a410663e-bf30-4c7e-b532-d6c8663fc88a', '355ddf91-4d5a-4c80-bd3a-3c1e6cdfbb2c', 'payment_out', 100.00, '1dfbcdf0-7090-4d04-a001-9736e61e9862', 'PO-13', 'Payment at purchase order', '2026-03-31 22:45:28.476363+00', NULL, NULL, NULL, NULL, 1),
	('b569d598-b230-4ded-bbf9-879520092961', '838f5c75-7728-4383-9ce5-da876bb5386b', 'payment_in', -60.00, '730094e4-acde-4f04-b75d-98be180f2d66', 'O-55', 'Order payment', '2026-04-07 20:15:20.369534+00', 'cash', '789389dc-5b9b-4361-ab0a-9d75d22d6cad', NULL, '2026-04-08 02:47:38.277+00', 1),
	('65a6acf5-c090-4ff1-94d0-d482e5e4a823', '838f5c75-7728-4383-9ce5-da876bb5386b', 'payment_in', -40.00, '730094e4-acde-4f04-b75d-98be180f2d66', 'O-55', 'Order payment', '2026-04-07 20:15:20.505191+00', 'visa', '789389dc-5b9b-4361-ab0a-9d75d22d6cad', NULL, '2026-04-08 02:47:38.277+00', 1),
	('d0faaee2-1150-4a85-b338-37fc7ea550c4', '355ddf91-4d5a-4c80-bd3a-3c1e6cdfbb2c', 'payment_out', 100.00, '1dfbcdf0-7090-4d04-a001-9736e61e9862', 'PO-13', 'Payment at purchase order', '2026-03-31 22:45:28.917372+00', NULL, NULL, NULL, NULL, 1),
	('25f4afed-a29d-4a27-a064-295d74161388', '355ddf91-4d5a-4c80-bd3a-3c1e6cdfbb2c', 'payment_out', 32.00, '82420264-c749-4d90-83f3-6c9ca3cd659a', 'PO-14', 'Payment at purchase order', '2026-03-31 23:08:49.325714+00', NULL, NULL, NULL, NULL, 1),
	('59b747e2-ff5e-475c-9dd2-4c0f724fadf7', '355ddf91-4d5a-4c80-bd3a-3c1e6cdfbb2c', 'payment_out', 32.00, '82420264-c749-4d90-83f3-6c9ca3cd659a', 'PO-14', 'Payment at purchase order', '2026-03-31 23:08:49.795196+00', NULL, NULL, NULL, NULL, 1),
	('651109b9-41b6-4d72-916b-246383054e01', '355ddf91-4d5a-4c80-bd3a-3c1e6cdfbb2c', 'payment_out', 5.00, '9d330912-f708-41cf-b9db-4dddf9ea40ea', 'PO-15', 'Payment at purchase order', '2026-03-31 23:39:42.92486+00', 'cash', '6ccc2cd9-b357-4e70-91f6-6db9bfbee86a', NULL, NULL, 1),
	('81689dce-8611-43b4-9c2b-a6a03275b2db', '355ddf91-4d5a-4c80-bd3a-3c1e6cdfbb2c', 'payment_out', 5.00, '9d330912-f708-41cf-b9db-4dddf9ea40ea', 'PO-15', 'Payment at purchase order', '2026-03-31 23:39:43.041555+00', 'visa', '6ccc2cd9-b357-4e70-91f6-6db9bfbee86a', NULL, NULL, 1),
	('e0a0392c-4d4c-4cdb-9720-b3576d8e7cc7', '355ddf91-4d5a-4c80-bd3a-3c1e6cdfbb2c', 'payment_out', 5.00, '9d330912-f708-41cf-b9db-4dddf9ea40ea', 'PO-15', 'Payment at purchase order', '2026-03-31 23:39:43.221748+00', 'cheque', '6ccc2cd9-b357-4e70-91f6-6db9bfbee86a', NULL, NULL, 1),
	('c48f24f7-18d6-4480-a691-e26ee28b969a', '355ddf91-4d5a-4c80-bd3a-3c1e6cdfbb2c', 'payment_out', 5.00, '9d330912-f708-41cf-b9db-4dddf9ea40ea', 'PO-15', 'Payment at purchase order', '2026-03-31 23:39:43.430919+00', 'instapay', '6ccc2cd9-b357-4e70-91f6-6db9bfbee86a', NULL, NULL, 1),
	('e1e36bb2-dade-442e-b790-989ecc4d0652', '355ddf91-4d5a-4c80-bd3a-3c1e6cdfbb2c', 'payment_out', 10000.00, '4d10da78-b34d-4b28-8755-3365103f1f51', 'PO-16', 'Payment at purchase order', '2026-04-02 00:28:07.145574+00', 'cash', NULL, NULL, NULL, 1),
	('e0da989f-9cf1-48d0-b354-e7e05004d332', '355ddf91-4d5a-4c80-bd3a-3c1e6cdfbb2c', 'payment_out', -10000.00, '4d10da78-b34d-4b28-8755-3365103f1f51', 'PO-16', 'Cancelled purchase order (reverse payment)', '2026-04-02 00:28:39.131224+00', NULL, NULL, NULL, NULL, 1),
	('dde7659d-dfdd-40d3-91a4-9626725daa97', '355ddf91-4d5a-4c80-bd3a-3c1e6cdfbb2c', 'payment_out', 50.00, '7384a9fd-22de-437b-92ed-355fce028dcf', 'PO-17', 'Payment at purchase order', '2026-04-02 00:46:48.254549+00', 'cash', NULL, NULL, NULL, 1),
	('3b73b21f-1fd0-4cb4-abb9-588b67c2de7b', '355ddf91-4d5a-4c80-bd3a-3c1e6cdfbb2c', 'payment_out', 50.00, '716e3a54-c389-426d-af82-2174ab3f5e7d', 'PO-18', 'Payment at purchase order', '2026-04-02 00:53:17.901286+00', 'visa', NULL, NULL, '2026-04-02 00:54:39.603+00', 1),
	('2c9523b1-d58a-4712-9d24-fc4a5e3f7262', '355ddf91-4d5a-4c80-bd3a-3c1e6cdfbb2c', 'payment_out', 100.00, '34045aed-4613-426d-b4b1-42dc39dcdad2', 'PO-19', 'Payment at purchase order', '2026-04-02 01:04:07.854599+00', 'cash', NULL, NULL, NULL, 1),
	('3652ef67-a690-4a8f-b64d-1c62629ff5bb', '355ddf91-4d5a-4c80-bd3a-3c1e6cdfbb2c', 'payment_out', 1000.00, '38695d77-2676-4f42-b085-5552a7b4e91b', 'PO-20', 'Payment at purchase order', '2026-04-02 01:26:04.137671+00', 'cash', NULL, NULL, NULL, 1),
	('91f92fdc-a3f5-4924-9498-a9c9ad090274', '355ddf91-4d5a-4c80-bd3a-3c1e6cdfbb2c', 'payment_out', -1000.00, '38695d77-2676-4f42-b085-5552a7b4e91b', 'PO-20', 'Cancelled purchase order (reverse payment)', '2026-04-02 01:26:33.575517+00', NULL, NULL, NULL, NULL, 1),
	('691aca09-2a15-4590-be6c-f366905a3784', '838f5c75-7728-4383-9ce5-da876bb5386b', 'payment_out', 334.00, '0950e2fa-2f1a-43c5-8cd2-27d2b17d9130', 'PO-21', 'Payment at purchase order', '2026-04-02 01:55:09.963625+00', 'cash', NULL, NULL, NULL, 1),
	('3f578eb3-98f8-4a0a-9dbc-42f17a25444d', '838f5c75-7728-4383-9ce5-da876bb5386b', 'payment_out', -334.00, '0950e2fa-2f1a-43c5-8cd2-27d2b17d9130', 'PO-21', 'Cancelled purchase order (reverse payment)', '2026-04-02 01:55:18.343358+00', NULL, NULL, NULL, NULL, 1),
	('c538a7c3-1091-4d72-8658-8a6cc662206d', '355ddf91-4d5a-4c80-bd3a-3c1e6cdfbb2c', 'payment_out', 100.00, '02fc9c1f-284f-4d0c-ae6e-d16a4cbd8147', 'PO-22', 'Payment at purchase order', '2026-04-02 03:09:58.75569+00', 'cash', NULL, NULL, NULL, 1),
	('72deaf6f-deb7-4615-a9eb-2609db50d536', '355ddf91-4d5a-4c80-bd3a-3c1e6cdfbb2c', 'payment_out', 44.00, 'e4d256fe-13f7-4b70-99dd-3be672d55c61', 'PO-23', 'Payment at purchase order', '2026-04-02 10:11:36.841372+00', 'cash', NULL, NULL, '2026-04-02 10:12:09.284+00', 1),
	('6b9d312c-8c0e-4a9f-a1b0-7fbd5f9810ba', '355ddf91-4d5a-4c80-bd3a-3c1e6cdfbb2c', 'payment_out', 50.00, 'af494e57-ebe9-4941-a45b-b14a02aa53af', 'PO-24', 'Payment at purchase order', '2026-04-02 10:27:25.149714+00', 'cash', '61c28cd8-9ef7-4929-81c8-c1d502617e1a', NULL, '2026-04-02 10:27:45.431+00', 1),
	('4d175d20-7b61-4266-befd-9aea760d9281', '355ddf91-4d5a-4c80-bd3a-3c1e6cdfbb2c', 'payment_out', 50.00, 'af494e57-ebe9-4941-a45b-b14a02aa53af', 'PO-24', 'Payment at purchase order', '2026-04-02 10:27:25.264883+00', 'visa', '61c28cd8-9ef7-4929-81c8-c1d502617e1a', NULL, '2026-04-02 10:27:45.431+00', 1),
	('7e8ae269-0a88-4dea-8818-9b9a932c1fd0', '838f5c75-7728-4383-9ce5-da876bb5386b', 'payment_out', 56.00, '2c133408-64ad-4fc1-a02c-5d4993b3aefb', 'PO-25', 'Payment at purchase order', '2026-04-02 19:24:03.012897+00', 'cash', NULL, NULL, '2026-04-02 19:24:24.471+00', 1),
	('d5c3332d-4325-4cd6-bd15-3354a504eb55', '838f5c75-7728-4383-9ce5-da876bb5386b', 'payment_out', 56.00, '2c133408-64ad-4fc1-a02c-5d4993b3aefb', 'PO-25', 'Retained · PO-25 — cancelled PO #25 (prepaid kept on account)', '2026-04-02 19:24:02.84869+00', 'cash', NULL, NULL, NULL, 1),
	('69ccbaa6-510f-4ab8-b783-b6eb9d85a10e', '355ddf91-4d5a-4c80-bd3a-3c1e6cdfbb2c', 'payment_out', 54.00, '9d4fd136-20a3-4491-aafb-eb9c73951681', 'PO-26', 'Payment at purchase order', '2026-04-03 17:17:43.189946+00', 'cash', NULL, NULL, '2026-04-03 17:18:02.09+00', 1),
	('2efc5108-3f6a-44cf-bec3-5211340da4ca', '355ddf91-4d5a-4c80-bd3a-3c1e6cdfbb2c', 'payment_out', 56.00, '1d7ec987-038d-4cb5-89e3-5059dcf7410a', 'PO-28', 'Payment at purchase order PO-19 · doc:34045aed-4613-426d-b4b1-42dc39dcdad2', '2026-04-03 20:19:55.880978+00', 'cash', NULL, NULL, NULL, 1),
	('856ba06c-d64f-47ff-b223-886611a463a7', NULL, 'adjustment', -544.00, '6d2e97d7-d05b-4028-aab8-fda2ed42f6de', 'O-58', 'Reversal of recorded payment', '2026-04-08 02:58:42.653968+00', NULL, NULL, NULL, NULL, NULL),
	('0523b049-8633-4b3e-901d-6d244c2e33de', NULL, 'order', 544.00, '6d2e97d7-d05b-4028-aab8-fda2ed42f6de', 'O-58', NULL, '2026-04-08 02:58:10.282841+00', NULL, NULL, NULL, '2026-04-08 02:58:42.667+00', NULL),
	('2ed1b8a1-369c-4320-82b5-6216de85c626', NULL, 'payment_in', -544.00, 'b5b31103-6df2-4614-b1d0-1e5130db5b9e', 'O-59', 'Order payment', '2026-04-09 23:40:52.639983+00', 'cheque', NULL, NULL, NULL, 1);


--
-- Data for Name: brands; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."brands" ("id", "name", "created_at") VALUES
	('3683f001-16ec-4357-a3af-a034b02b99a3', 'Bisco', '2026-03-07 15:11:44.946124+00'),
	('c25d706b-9ee8-4fc9-9b74-1dbb7d6e133d', 'h', '2026-04-10 00:19:57.410505+00'),
	('06300a5a-fc8c-4f3e-bde4-9d524cca19e4', 'hh', '2026-04-10 00:20:01.132423+00');


--
-- Data for Name: categories; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."categories" ("id", "name", "created_at") VALUES
	('5f82c849-0ab2-42f9-a19b-683933efc391', 'Composite', '2026-03-07 15:11:33.290953+00'),
	('c1f9c1b4-084a-4249-a4e4-f63b0f4992c2', 'testing 1', '2026-04-06 20:27:06.19893+00'),
	('f13fde1f-2b64-49e6-b486-9aa937afdaa4', 'c1', '2026-04-10 00:19:57.606762+00'),
	('fe900174-684a-4a04-a493-2a120750f8c8', 'c2', '2026-04-10 00:19:58.182522+00'),
	('947d1268-1c32-4d07-857e-ccbf7386fbbd', 'c3', '2026-04-10 00:19:58.682257+00'),
	('dc1f8c93-93e7-493f-93dc-5f1950af44d3', 'c4', '2026-04-10 00:19:59.145077+00'),
	('e87a1169-9ea1-435e-8a60-b9fb90f4d787', 'c5', '2026-04-10 00:19:59.802166+00'),
	('5d3264b1-9392-40bc-8757-4031cae26718', 'c6', '2026-04-10 00:20:00.14981+00'),
	('39eeea08-0ce5-49da-9da3-e9037cf2f3d6', 'c9', '2026-04-10 00:20:01.24286+00'),
	('880c586f-2f59-4d58-b852-824995d6d7c7', 'c10', '2026-04-10 00:20:01.585937+00');


--
-- Data for Name: inventory_transfers; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."inventory_transfers" ("id", "transfer_number", "from_warehouse_id", "to_warehouse_id", "note", "created_at", "updated_at") VALUES
	('c015937b-b754-490c-89a4-ef104ab9f071', 1, 1, 2, NULL, '2026-04-08 00:55:48.278827+00', '2026-04-08 00:55:48.278827+00'),
	('d5800d86-5445-4510-842e-dee627488364', 2, 2, 1, NULL, '2026-04-08 02:42:29.540577+00', '2026-04-08 02:42:29.540577+00'),
	('43758436-a79b-4308-83bf-f13c67cfc9c9', 3, 1, 2, NULL, '2026-04-08 02:57:45.675945+00', '2026-04-08 02:57:45.675945+00');


--
-- Data for Name: products; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."products" ("id", "name", "brand_id", "category_id", "customer_price", "business_price", "cost_price", "quantity", "low_stock_threshold", "unit", "description", "created_at", "updated_at", "product_code", "average_unit_cost") VALUES
	('0cad7111-0399-4524-8f29-eedaa64c4106', 'B9', '06300a5a-fc8c-4f3e-bde4-9d524cca19e4', '39eeea08-0ce5-49da-9da3-e9037cf2f3d6', 0.00, 0.00, 0.00, 0, 0, 'pc', NULL, '2026-04-10 00:20:01.360454+00', '2026-04-10 00:20:01.360454+00', 'P-EC4B206987', NULL),
	('8c5a9dff-4603-48a2-bf14-53d80d586c4c', 'B10', 'c25d706b-9ee8-4fc9-9b74-1dbb7d6e133d', '880c586f-2f59-4d58-b852-824995d6d7c7', 0.00, 0.00, 0.00, 0, 0, 'pc', NULL, '2026-04-10 00:20:01.691849+00', '2026-04-10 00:20:01.691849+00', 'P-F26CF967E0', NULL),
	('0427ab34-b940-49de-9de3-e2127a25070c', 'bond', '3683f001-16ec-4357-a3af-a034b02b99a3', '5f82c849-0ab2-42f9-a19b-683933efc391', 120.00, 100.00, 45.00, 475, 5, 'piece', NULL, '2026-03-29 00:11:37.660392+00', '2026-04-07 22:46:37.451888+00', 'ssa2', 45.00),
	('4df4d69c-9c2f-4221-8816-5eae1947bd96', 'bond-0', '3683f001-16ec-4357-a3af-a034b02b99a3', '5f82c849-0ab2-42f9-a19b-683933efc391', 12.00, 9.00, 2.00, 24, 5, 'piece', NULL, '2026-03-29 00:12:10.832095+00', '2026-04-07 22:46:37.451888+00', 'P-90959EBA9D', 2.00),
	('38e5be56-bbc6-45af-ae50-f9569bfe6ca3', '0.5 bond', '3683f001-16ec-4357-a3af-a034b02b99a3', '5f82c849-0ab2-42f9-a19b-683933efc391', 355.00, 350.00, 340.00, 4, 5, 'piece', NULL, '2026-03-07 15:12:22.957087+00', '2026-04-07 22:46:37.451888+00', 'AUTO-38E5BE56BB', 340.00),
	('c7fc94f5-471c-48c4-8385-126efafa3e3f', '0.5 bond — c7fc94f5', '3683f001-16ec-4357-a3af-a034b02b99a3', '5f82c849-0ab2-42f9-a19b-683933efc391', 544.00, 540.00, 35.00, 1251, 5, 'piece', NULL, '2026-03-07 15:13:12.065152+00', '2026-04-09 23:41:24.37373+00', 'AUTO-C7FC94F547', 35.00),
	('85b8a723-eb11-46a2-84a2-938567295b42', 'B1', 'c25d706b-9ee8-4fc9-9b74-1dbb7d6e133d', 'f13fde1f-2b64-49e6-b486-9aa937afdaa4', 0.00, 0.00, 0.00, 0, 0, 'pc', NULL, '2026-04-10 00:19:57.800201+00', '2026-04-10 00:19:57.800201+00', 'P-761684D56A', NULL),
	('d801a523-4fea-46ae-82bb-b72d693d7d79', 'B2', 'c25d706b-9ee8-4fc9-9b74-1dbb7d6e133d', 'fe900174-684a-4a04-a493-2a120750f8c8', 0.00, 0.00, 0.00, 0, 0, 'pc', NULL, '2026-04-10 00:19:58.311337+00', '2026-04-10 00:19:58.311337+00', 'P-9F53241C00', NULL),
	('76c4b15f-dd30-404c-92eb-12f3fabf3149', 'B3', 'c25d706b-9ee8-4fc9-9b74-1dbb7d6e133d', '947d1268-1c32-4d07-857e-ccbf7386fbbd', 0.00, 0.00, 0.00, 0, 0, 'pc', NULL, '2026-04-10 00:19:58.871717+00', '2026-04-10 00:19:58.871717+00', 'P-6B4DBE1855', NULL),
	('cab1e4f8-6d00-4f5a-98d5-c442461c70d7', 'B4', 'c25d706b-9ee8-4fc9-9b74-1dbb7d6e133d', 'dc1f8c93-93e7-493f-93dc-5f1950af44d3', 0.00, 0.00, 0.00, 0, 0, 'pc', NULL, '2026-04-10 00:19:59.25591+00', '2026-04-10 00:19:59.25591+00', 'P-5886E788FC', NULL),
	('4e26bebe-7a8e-4992-989f-8a1547bb90e1', 'B5', 'c25d706b-9ee8-4fc9-9b74-1dbb7d6e133d', 'e87a1169-9ea1-435e-8a60-b9fb90f4d787', 0.00, 0.00, 0.00, 0, 0, 'pc', NULL, '2026-04-10 00:19:59.911175+00', '2026-04-10 00:19:59.911175+00', 'P-7601874925', NULL),
	('33634e7b-ac77-471d-98dd-c67b812d6259', 'B6', 'c25d706b-9ee8-4fc9-9b74-1dbb7d6e133d', '5d3264b1-9392-40bc-8757-4031cae26718', 0.00, 0.00, 0.00, 0, 0, 'pc', NULL, '2026-04-10 00:20:00.262342+00', '2026-04-10 00:20:00.262342+00', 'P-DF15E0AB86', NULL);


--
-- Data for Name: inventory_transfer_items; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."inventory_transfer_items" ("id", "transfer_id", "product_id", "quantity") VALUES
	('31f1dfb8-cd07-4de4-a8fc-60bc1a98a27a', 'c015937b-b754-490c-89a4-ef104ab9f071', 'c7fc94f5-471c-48c4-8385-126efafa3e3f', 1),
	('ac8d6d7d-80a5-40ef-87f4-083e137ef0b3', 'd5800d86-5445-4510-842e-dee627488364', 'c7fc94f5-471c-48c4-8385-126efafa3e3f', 30),
	('e1ab20a8-f8fb-4ac9-a117-b8764ff850dd', '43758436-a79b-4308-83bf-f13c67cfc9c9', 'c7fc94f5-471c-48c4-8385-126efafa3e3f', 10);


--
-- Data for Name: orders; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."orders" ("id", "order_number", "type", "status", "payment_method", "note", "total_amount", "created_at", "updated_at", "person_id", "status_flow", "paid_amount", "remaining_amount", "discount_amount", "discount_rate", "subtotal", "allow_remaining_on_account", "warehouse_id", "is_historical_snapshot") VALUES
	('0a7813f6-15c9-4d9e-a432-15b6770f51e7', 61, 'retail', 'completed', NULL, NULL, 173.00, '2026-04-10 00:34:20.75662+00', '2026-04-10 00:34:20.65+00', NULL, 'completed', 173.00, 0.00, 0.00, 0.00, 173.00, false, 1, true),
	('092162ea-b0ba-42f2-a179-7fa8b85180f7', 64, 'retail', 'completed', NULL, NULL, 771.00, '2026-04-10 00:35:04.21636+00', '2026-04-10 00:35:04.098+00', NULL, 'completed', 771.00, 0.00, 0.00, 0.00, 771.00, false, 1, true),
	('e01bb57c-6141-4b31-88c3-4723cb67da7a', 67, 'retail', 'completed', NULL, NULL, 173.00, '2026-04-10 00:46:32.582+00', '2026-04-10 00:46:32.942+00', NULL, 'completed', 173.00, 0.00, 0.00, 0.00, 173.00, false, 1, true),
	('4dece1dd-e707-416b-a273-c5ad3a246371', 16, 'retail', 'pending', NULL, NULL, 120.00, '2026-03-31 21:50:42.109319+00', '2026-03-31 21:50:43.721+00', '838f5c75-7728-4383-9ce5-da876bb5386b', 'confirmed', 0.00, 120.00, 0.00, 0.00, 120.00, true, 1, false),
	('730094e4-acde-4f04-b75d-98be180f2d66', 55, 'retail', 'cancelled', 'cash', NULL, 544.00, '2026-04-07 20:15:17.45575+00', '2026-04-08 02:47:40.23+00', '838f5c75-7728-4383-9ce5-da876bb5386b', 'cancelled', 0.00, 544.00, 0.00, 0.00, 544.00, true, 1, false),
	('99d3d730-b671-4f57-ab19-04d83dfb92b3', 62, 'retail', 'completed', NULL, NULL, 771.00, '2026-04-10 00:34:21.47152+00', '2026-04-10 00:34:21.372+00', NULL, 'completed', 771.00, 0.00, 0.00, 0.00, 771.00, false, 1, true),
	('41986349-acd7-499a-8cd2-5b4edddffba4', 17, 'retail', 'pending', 'cash', NULL, 240.00, '2026-03-31 22:13:58.858135+00', '2026-03-31 22:13:58.858135+00', '838f5c75-7728-4383-9ce5-da876bb5386b', 'draft', 20.00, 220.00, 0.00, 0.00, 240.00, true, 1, false),
	('0cc744da-3049-4770-9efb-63a32061b9bf', 18, 'retail', 'pending', 'cash', NULL, 240.00, '2026-03-31 22:14:38.136754+00', '2026-03-31 22:14:38.136754+00', '838f5c75-7728-4383-9ce5-da876bb5386b', 'draft', 20.00, 220.00, 0.00, 0.00, 240.00, true, 1, false),
	('c45005fd-e17c-41a4-b720-ed7d4a78d332', 19, 'retail', 'pending', 'cash', NULL, 240.00, '2026-03-31 22:14:48.677112+00', '2026-03-31 22:14:50.881+00', '838f5c75-7728-4383-9ce5-da876bb5386b', 'confirmed', 10.00, 230.00, 0.00, 0.00, 240.00, true, 1, false),
	('3db56bd1-2707-4759-afc5-2c81dd0545c4', 20, 'retail', 'pending', 'cash', NULL, 544.00, '2026-03-31 22:29:52.306988+00', '2026-03-31 22:29:54.476+00', '838f5c75-7728-4383-9ce5-da876bb5386b', 'confirmed', 20.00, 524.00, 0.00, 0.00, 544.00, true, 1, false),
	('fce7f76d-6937-46bb-8bc3-71002b626f4b', 21, 'retail', 'pending', 'cash', NULL, 544.00, '2026-03-31 22:44:06.521749+00', '2026-03-31 22:44:08.291+00', '838f5c75-7728-4383-9ce5-da876bb5386b', 'confirmed', 55.00, 489.00, 0.00, 0.00, 544.00, true, 1, false),
	('b750534c-d423-437c-8d43-2700338ce07e', 22, 'retail', 'pending', 'cash', NULL, 544.00, '2026-03-31 22:47:38.403502+00', '2026-03-31 22:47:40.036+00', '838f5c75-7728-4383-9ce5-da876bb5386b', 'confirmed', 200.00, 344.00, 0.00, 0.00, 544.00, true, 1, false),
	('65388b17-59d4-4a18-bb75-caa49644d66d', 23, 'retail', 'pending', NULL, NULL, 544.00, '2026-03-31 23:06:27.746575+00', '2026-03-31 23:06:29.317+00', '838f5c75-7728-4383-9ce5-da876bb5386b', 'confirmed', 0.00, 544.00, 0.00, 0.00, 544.00, true, 1, false),
	('7203a5f1-d1fb-4665-abf2-21ee91086ca5', 24, 'retail', 'pending', 'cash', NULL, 544.00, '2026-03-31 23:06:54.555686+00', '2026-03-31 23:06:55.996+00', '838f5c75-7728-4383-9ce5-da876bb5386b', 'confirmed', 544.00, 0.00, 0.00, 0.00, 544.00, true, 1, false),
	('bff051c9-9954-4e15-9191-38d501dcbb1b', 25, 'retail', 'completed', 'cash', NULL, 544.00, '2026-03-31 23:23:21.685021+00', '2026-03-31 23:23:24.069+00', NULL, 'completed', 544.00, 0.00, 0.00, 0.00, 544.00, false, 1, false),
	('46baeabf-bbd9-4afa-988b-6c204dc9a253', 26, 'retail', 'pending', 'cash', NULL, 544.00, '2026-03-31 23:23:52.984827+00', '2026-03-31 23:23:54.919+00', '838f5c75-7728-4383-9ce5-da876bb5386b', 'confirmed', 344.00, 200.00, 0.00, 0.00, 544.00, true, 1, false),
	('b53084d6-92c0-4beb-9f4a-f66d15f86bf3', 1, 'retail', 'pending', 'cash', NULL, 2415.00, '2026-03-07 15:17:20.547628+00', '2026-03-07 15:17:20.547628+00', NULL, 'confirmed', 0.00, 2415.00, 0.00, 0.00, 2415.00, false, 1, false),
	('25c7cd93-49ac-4f7c-8dd9-e01a7037e049', 2, 'retail', 'pending', 'cash', NULL, 5440.00, '2026-03-14 14:30:51.303875+00', '2026-03-14 14:30:51.303875+00', NULL, 'confirmed', 0.00, 5440.00, 0.00, 0.00, 5440.00, false, 1, false),
	('df34228a-92ac-458b-81c3-0f8a421a9bd9', 3, 'retail', 'pending', 'cash', NULL, 5440.00, '2026-03-14 14:30:59.311221+00', '2026-03-14 14:30:59.311221+00', NULL, 'confirmed', 0.00, 5440.00, 0.00, 0.00, 5440.00, false, 1, false),
	('603ff087-7256-4ecc-b5e4-6581910dc491', 4, 'retail', 'pending', 'cash', NULL, 3450.00, '2026-03-14 14:31:31.968494+00', '2026-03-14 14:31:31.968494+00', NULL, 'confirmed', 0.00, 3450.00, 0.00, 0.00, 3450.00, false, 1, false),
	('44c3e7a8-ccbd-42ee-9eba-431a1129d62e', 5, 'retail', 'pending', 'cash', NULL, 1725.00, '2026-03-14 14:36:06.921761+00', '2026-03-14 14:36:06.921761+00', NULL, 'confirmed', 0.00, 1725.00, 0.00, 0.00, 1725.00, false, 1, false),
	('e62a1878-c0ba-42db-82c7-93970ced35b0', 6, 'retail', 'pending', 'cash', NULL, 345.00, '2026-03-14 14:39:24.2832+00', '2026-03-14 14:39:24.2832+00', NULL, 'confirmed', 0.00, 345.00, 0.00, 0.00, 345.00, false, 1, false),
	('d05ce3f4-ef91-488a-8237-35a3307f2001', 7, 'retail', 'pending', 'cash', NULL, 345.00, '2026-03-14 14:40:58.776698+00', '2026-03-14 14:40:58.776698+00', NULL, 'confirmed', 345.00, 0.00, 0.00, 0.00, 345.00, false, 1, false),
	('b2111665-993c-4dfb-84ca-fc2fb20de6af', 8, 'retail', 'pending', NULL, NULL, 345.00, '2026-03-28 22:59:10.154396+00', '2026-03-28 22:59:10.154396+00', '838f5c75-7728-4383-9ce5-da876bb5386b', 'confirmed', 0.00, 345.00, 0.00, 0.00, 345.00, false, 1, false),
	('5f370fc2-113a-49d6-874e-19b5210c2a0b', 9, 'retail', 'pending', NULL, NULL, 2448.00, '2026-03-28 23:00:48.817451+00', '2026-03-28 23:00:48.817451+00', '838f5c75-7728-4383-9ce5-da876bb5386b', 'confirmed', 0.00, 2448.00, 0.00, 0.00, 2448.00, false, 1, false),
	('2aec1109-d9b7-433a-8106-22ad13090685', 10, 'retail', 'pending', 'cash', NULL, 979.20, '2026-03-28 23:52:55.63925+00', '2026-03-28 23:52:57.532+00', '838f5c75-7728-4383-9ce5-da876bb5386b', 'confirmed', 88.00, 891.20, 108.80, 10.00, 1088.00, true, 1, false),
	('1fba40f7-6193-4f3e-91c7-ab141e109f43', 11, 'wholesale', 'pending', 'cash', NULL, 135.00, '2026-03-29 00:29:05.190755+00', '2026-03-29 00:29:06.638+00', '838f5c75-7728-4383-9ce5-da876bb5386b', 'confirmed', 134.00, 1.00, 0.00, 0.00, 135.00, true, 1, false),
	('62af9257-723b-42a6-ad1a-d88228451869', 12, 'retail', 'pending', NULL, NULL, 544.00, '2026-03-29 00:30:27.728143+00', '2026-03-29 00:30:27.728143+00', '838f5c75-7728-4383-9ce5-da876bb5386b', 'draft', 0.00, 544.00, 0.00, 0.00, 544.00, false, 1, false),
	('a48a508a-7239-4e6b-a43f-3fcd4c9a92cd', 13, 'retail', 'completed', 'cash', NULL, 544.00, '2026-03-29 00:54:58.886574+00', '2026-03-29 00:55:01.617+00', '838f5c75-7728-4383-9ce5-da876bb5386b', 'completed', 544.00, 0.00, 0.00, 0.00, 544.00, true, 1, false),
	('fb4c2a3e-5dc1-4ee9-b6d6-5291a59465eb', 14, 'retail', 'pending', NULL, NULL, 6375.60, '2026-03-29 01:06:06.156437+00', '2026-03-29 01:06:06.156437+00', NULL, 'draft', 0.00, 6375.60, 708.40, 10.00, 7084.00, false, 1, false),
	('2d9e8bf7-ed2f-44c3-96b5-1e707ce8f156', 15, 'retail', 'pending', NULL, NULL, 5443.00, '2026-03-29 01:09:30.806969+00', '2026-03-30 01:47:23.548+00', '838f5c75-7728-4383-9ce5-da876bb5386b', 'confirmed', 45.00, 5398.00, 0.00, 0.00, 5443.00, true, 1, false),
	('40666a26-dfca-4b19-b22a-53096124ecbc', 40, 'retail', 'cancelled', 'cash', NULL, 544.00, '2026-04-02 10:03:50.351514+00', '2026-04-02 10:04:19.716+00', NULL, 'cancelled', 0.00, 544.00, 0.00, 0.00, 544.00, false, 1, false),
	('abab5267-cd88-43ef-942f-54020fd5e54f', 35, 'retail', 'completed', 'instapay', NULL, 544.00, '2026-04-02 01:52:42.971853+00', '2026-04-02 01:52:44.687+00', NULL, 'completed', 544.00, 0.00, 0.00, 0.00, 544.00, false, 1, false),
	('c0f1704a-0587-41c1-8cdc-13cf41d71446', 28, 'retail', 'completed', 'cash', NULL, 544.00, '2026-04-01 00:03:13.943868+00', '2026-04-01 00:03:16.055+00', NULL, 'completed', 544.00, 0.00, 0.00, 0.00, 544.00, false, 1, false),
	('0c8182d1-244c-44c7-b8ad-a98697ad5bdd', 29, 'retail', 'completed', 'visa', NULL, 544.00, '2026-04-01 22:27:53.618267+00', '2026-04-01 22:27:56.084+00', NULL, 'completed', 544.00, 0.00, 0.00, 0.00, 544.00, false, 1, false),
	('46002391-dd3b-4983-92cd-c6cee34a8eca', 30, 'retail', 'completed', 'cash', NULL, 144.00, '2026-04-01 22:29:21.193402+00', '2026-04-01 22:29:23.313+00', NULL, 'completed', 144.00, 0.00, 0.00, 0.00, 144.00, false, 1, false),
	('92b40023-af9c-43a1-9ea7-aed1265a3259', 36, 'retail', 'completed', 'cash', NULL, 544.00, '2026-04-02 01:54:30.143342+00', '2026-04-02 01:54:32.421+00', NULL, 'completed', 544.00, 0.00, 0.00, 0.00, 544.00, false, 1, false),
	('fef6ef84-ff47-4b69-83d5-7db75bdd0fab', 31, 'retail', 'cancelled', NULL, NULL, 544.00, '2026-04-02 00:18:55.799079+00', '2026-04-02 00:19:39.974+00', '838f5c75-7728-4383-9ce5-da876bb5386b', 'cancelled', 0.00, 544.00, 0.00, 0.00, 544.00, true, 1, false),
	('90334559-1459-4a79-beb5-01a76ad51f9d', 32, 'retail', 'cancelled', 'cash', NULL, 544.00, '2026-04-02 00:20:05.659097+00', '2026-04-02 00:20:55.554+00', '838f5c75-7728-4383-9ce5-da876bb5386b', 'cancelled', 200.00, 344.00, 0.00, 0.00, 544.00, true, 1, false),
	('5067510d-8cf8-4e95-84e1-68136d1e9ae7', 33, 'retail', 'cancelled', 'cash', NULL, 544.00, '2026-04-02 01:27:45.438283+00', '2026-04-02 01:27:58.538+00', '838f5c75-7728-4383-9ce5-da876bb5386b', 'cancelled', 100.00, 444.00, 0.00, 0.00, 544.00, true, 1, false),
	('164ff500-0ea5-4eb5-afd5-084b1ab48f14', 37, 'retail', 'cancelled', 'visa', NULL, 544.00, '2026-04-02 03:06:50.756414+00', '2026-04-02 03:08:36.682+00', '838f5c75-7728-4383-9ce5-da876bb5386b', 'cancelled', 0.00, 544.00, 0.00, 0.00, 544.00, true, 1, false),
	('fdaa4a83-19af-4420-9410-66c649612905', 34, 'retail', 'cancelled', 'cheque', NULL, 544.00, '2026-04-02 01:35:05.350891+00', '2026-04-02 01:35:29.961+00', '838f5c75-7728-4383-9ce5-da876bb5386b', 'cancelled', 0.00, 544.00, 0.00, 0.00, 544.00, true, 1, false),
	('9b4cf31f-a2e0-4bbd-af84-07376f0dddfa', 27, 'retail', 'cancelled', 'cash', NULL, 544.00, '2026-03-31 23:38:47.629163+00', '2026-04-02 01:51:27.576+00', '838f5c75-7728-4383-9ce5-da876bb5386b', 'cancelled', 0.00, 544.00, 0.00, 0.00, 544.00, true, 1, false),
	('eef3675a-9783-4526-a383-fa1956cff02c', 47, 'retail', 'cancelled', 'cash', NULL, 544.00, '2026-04-02 20:01:17.228051+00', '2026-04-02 20:01:36.453+00', '838f5c75-7728-4383-9ce5-da876bb5386b', 'cancelled', 0.00, 544.00, 0.00, 0.00, 544.00, true, 1, false),
	('65ad992a-770c-4ec2-95bb-feaa4ea81806', 38, 'retail', 'pending', 'cash', NULL, 5440.00, '2026-04-02 03:21:16.976966+00', '2026-04-02 03:22:12.665+00', '838f5c75-7728-4383-9ce5-da876bb5386b', 'confirmed', 0.00, 5440.00, 0.00, 0.00, 5440.00, true, 1, false),
	('338b175f-c2f3-4074-9d9d-0fdd7fa9418c', 41, 'retail', 'cancelled', 'visa', NULL, 544.00, '2026-04-02 10:09:54.302344+00', '2026-04-02 10:10:12.275+00', NULL, 'cancelled', 0.00, 544.00, 0.00, 0.00, 544.00, false, 1, false),
	('2d662acf-740d-434b-aabc-f1fcf82515e1', 39, 'retail', 'cancelled', 'visa', NULL, 544.00, '2026-04-02 03:35:37.562653+00', '2026-04-02 03:35:54.959+00', '838f5c75-7728-4383-9ce5-da876bb5386b', 'cancelled', 0.00, 544.00, 0.00, 0.00, 544.00, true, 1, false),
	('a539c1fc-561d-4c55-8f7c-65a7e89bd43b', 44, 'retail', 'cancelled', 'cash', NULL, 544.00, '2026-04-02 19:25:19.617753+00', '2026-04-02 19:25:38.74+00', '838f5c75-7728-4383-9ce5-da876bb5386b', 'cancelled', 0.00, 544.00, 0.00, 0.00, 544.00, true, 1, false),
	('a95c140f-32fa-4b76-96aa-5728a190406a', 42, 'retail', 'cancelled', 'cash', NULL, 544.00, '2026-04-02 10:29:44.355913+00', '2026-04-02 10:30:02.276+00', '838f5c75-7728-4383-9ce5-da876bb5386b', 'cancelled', 0.00, 544.00, 0.00, 0.00, 544.00, true, 1, false),
	('2658f5ce-51d2-44df-834b-9b2065547dd5', 46, 'retail', 'cancelled', 'cash', NULL, 544.00, '2026-04-02 19:58:46.152354+00', '2026-04-02 19:59:16.056+00', '838f5c75-7728-4383-9ce5-da876bb5386b', 'cancelled', 0.00, 544.00, 0.00, 0.00, 544.00, false, 1, false),
	('101ed81f-d220-434a-a216-d2aeeb8a395a', 43, 'retail', 'cancelled', 'visa', NULL, 544.00, '2026-04-02 19:09:49.281202+00', '2026-04-02 19:10:34.623+00', '838f5c75-7728-4383-9ce5-da876bb5386b', 'cancelled', 0.00, 544.00, 0.00, 0.00, 544.00, true, 1, false),
	('d301035b-1b48-4f7a-90fb-88a0e2e3070c', 45, 'retail', 'cancelled', 'visa', NULL, 544.00, '2026-04-02 19:34:53.982435+00', '2026-04-02 19:35:11.772+00', '838f5c75-7728-4383-9ce5-da876bb5386b', 'cancelled', 0.00, 544.00, 0.00, 0.00, 544.00, true, 1, false),
	('1f3ec53c-8b0f-4d27-8a2d-90f449263b35', 48, 'retail', 'cancelled', 'visa', NULL, 544.00, '2026-04-02 20:16:20.450237+00', '2026-04-02 20:16:40.818+00', '838f5c75-7728-4383-9ce5-da876bb5386b', 'cancelled', 0.00, 544.00, 0.00, 0.00, 544.00, true, 1, false),
	('8cd2a495-515c-4eb6-9246-c5ab84a6f5a3', 49, 'retail', 'completed', 'cash', NULL, 544.00, '2026-04-03 18:23:47.111883+00', '2026-04-03 18:23:50.372+00', NULL, 'completed', 544.00, 0.00, 0.00, 0.00, 544.00, false, 1, false),
	('0c9183c4-9d0e-48bc-949f-da42edecd089', 54, 'retail', 'cancelled', 'cash', NULL, 544.00, '2026-04-07 20:11:59.295786+00', '2026-04-07 20:13:22.163+00', '838f5c75-7728-4383-9ce5-da876bb5386b', 'cancelled', 0.00, 544.00, 0.00, 0.00, 544.00, true, 1, false),
	('a2928706-a242-4480-9c0a-040276e6353a', 65, 'retail', 'pending', NULL, NULL, 173.00, '2026-04-10 00:36:40.417894+00', '2026-04-10 00:36:40.417894+00', NULL, 'draft', 0.00, 173.00, 0.00, 0.00, 173.00, true, 1, false),
	('bf119e3a-ca32-43a8-b431-eaeec8e91068', 68, 'retail', 'completed', NULL, NULL, 771.00, '2026-04-10 00:46:34.272+00', '2026-04-10 00:46:34.476+00', NULL, 'completed', 771.00, 0.00, 0.00, 0.00, 771.00, false, 1, true),
	('ca755135-040a-4c66-bf92-05549232ea6b', 50, 'retail', 'completed', 'cash', 'follow up O-49 · doc:8cd2a495-515c-4eb6-9246-c5ab84a6f5a3 , then I can add more  O-50 · doc:ca755135-040a-4c66-bf92-05549232ea6b

new comment O-50 · doc:ca755135-040a-4c66-bf92-05549232ea6b', 544.00, '2026-04-03 20:21:39.849885+00', '2026-04-03 20:37:02.113+00', NULL, 'completed', 544.00, 0.00, 0.00, 0.00, 544.00, false, 1, false),
	('5b21ce4e-42c4-4c09-bc4e-e7336f064a66', 51, 'retail', 'pending', NULL, NULL, 4896.00, '2026-04-03 22:13:40.073301+00', '2026-04-03 22:13:41.86+00', '91810f5e-4dbe-4126-ba9b-e21fc12f41cf', 'confirmed', 0.00, 4896.00, 544.00, 10.00, 5440.00, true, 1, false),
	('29582a30-7354-4830-809f-c5472e9319aa', 52, 'retail', 'pending', 'cash', NULL, 544.00, '2026-04-03 23:21:12.762205+00', '2026-04-03 23:21:14.61+00', '838f5c75-7728-4383-9ce5-da876bb5386b', 'confirmed', 44.00, 500.00, 0.00, 0.00, 544.00, true, 1, false),
	('7569308c-b7c6-4d9f-80fa-c150b620798a', 53, 'retail', 'completed', 'cash', NULL, 5175.00, '2026-04-04 13:55:25.992583+00', '2026-04-04 13:55:28.717+00', NULL, 'completed', 5175.00, 0.00, 0.00, 0.00, 5175.00, false, 1, false),
	('b8b86194-5549-4454-8ed0-fcc29265a463', 56, 'retail', 'pending', NULL, NULL, 544.00, '2026-04-07 22:51:46.684998+00', '2026-04-07 22:51:48.414+00', '91810f5e-4dbe-4126-ba9b-e21fc12f41cf', 'confirmed', 0.00, 544.00, 0.00, 0.00, 544.00, true, 2, false),
	('e641a504-cda5-4e73-b335-b68944c0e696', 63, 'retail', 'completed', NULL, NULL, 173.00, '2026-04-10 00:35:03.348507+00', '2026-04-10 00:35:03.223+00', NULL, 'completed', 173.00, 0.00, 0.00, 0.00, 173.00, false, 1, true),
	('3655734a-2b6d-448e-a66d-7a5cf1524a84', 66, 'retail', 'pending', NULL, NULL, 771.00, '2026-04-10 00:36:41.27638+00', '2026-04-10 00:36:41.27638+00', NULL, 'draft', 0.00, 771.00, 0.00, 0.00, 771.00, true, 1, false),
	('4b687a20-9b84-44c0-97ea-3de9f6d43e37', 57, 'retail', 'cancelled', 'visa', NULL, 544.00, '2026-04-08 02:30:49.668265+00', '2026-04-08 02:46:53.116+00', NULL, 'cancelled', 0.00, 544.00, 0.00, 0.00, 544.00, false, 1, false),
	('6d2e97d7-d05b-4028-aab8-fda2ed42f6de', 58, 'retail', 'cancelled', 'instapay', NULL, 544.00, '2026-04-08 02:58:07.845174+00', '2026-04-08 02:58:42.842+00', NULL, 'cancelled', 0.00, 544.00, 0.00, 0.00, 544.00, false, 2, false),
	('b5b31103-6df2-4614-b1d0-1e5130db5b9e', 59, 'retail', 'completed', 'cheque', NULL, 544.00, '2026-04-09 23:40:49.150472+00', '2026-04-09 23:40:52.871+00', NULL, 'completed', 544.00, 0.00, 0.00, 0.00, 544.00, false, 1, false),
	('379b1388-e18c-4e71-a9cc-db957bb5cbd8', 60, 'retail', 'completed', 'cash', NULL, 544.00, '2026-04-09 23:41:22.427486+00', '2026-04-09 23:41:25.098+00', NULL, 'completed', 544.00, 0.00, 0.00, 0.00, 544.00, false, 2, false);


--
-- Data for Name: order_items; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."order_items" ("id", "order_id", "product_id", "quantity", "unit_price", "total_price", "created_at", "line_discount_rate") VALUES
	('853d61ae-c59c-482d-b63c-cbbf68b3f676', 'b53084d6-92c0-4beb-9f4a-f66d15f86bf3', '38e5be56-bbc6-45af-ae50-f9569bfe6ca3', 7, 345.00, 2415.00, '2026-03-07 15:17:20.748526+00', 0.00),
	('d08d7927-b1f7-4893-a291-29b961b393d4', 'd05ce3f4-ef91-488a-8237-35a3307f2001', '38e5be56-bbc6-45af-ae50-f9569bfe6ca3', 1, 345.00, 345.00, '2026-03-14 14:40:59.075084+00', 0.00),
	('cc6bf1f5-1dfd-4691-8f99-3ca9893a198b', 'b2111665-993c-4dfb-84ca-fc2fb20de6af', '38e5be56-bbc6-45af-ae50-f9569bfe6ca3', 1, 345.00, 345.00, '2026-03-28 22:59:10.349412+00', 0.00),
	('e2a01c45-a6ea-4822-ac14-9c9a0fb6d7ac', '5f370fc2-113a-49d6-874e-19b5210c2a0b', 'c7fc94f5-471c-48c4-8385-126efafa3e3f', 5, 544.00, 2720.00, '2026-03-28 23:00:48.932447+00', 0.00),
	('5b69b3e7-feb2-45a7-9bae-473fac87fe95', '2aec1109-d9b7-433a-8106-22ad13090685', 'c7fc94f5-471c-48c4-8385-126efafa3e3f', 2, 544.00, 1088.00, '2026-03-28 23:52:55.858796+00', 0.00),
	('f774b0f1-4462-4299-b7cf-8d3974d33615', '1fba40f7-6193-4f3e-91c7-ab141e109f43', '4df4d69c-9c2f-4221-8816-5eae1947bd96', 15, 9.00, 135.00, '2026-03-29 00:29:05.33131+00', 0.00),
	('ba14a9e1-d89c-4aea-8533-2a9d90598bfa', '62af9257-723b-42a6-ad1a-d88228451869', 'c7fc94f5-471c-48c4-8385-126efafa3e3f', 1, 544.00, 544.00, '2026-03-29 00:30:27.86586+00', 0.00),
	('f5965855-922d-4ecc-b64f-7b949172a2d2', 'a48a508a-7239-4e6b-a43f-3fcd4c9a92cd', 'c7fc94f5-471c-48c4-8385-126efafa3e3f', 1, 544.00, 544.00, '2026-03-29 00:54:59.143983+00', 0.00),
	('cadeda87-2c0e-4dd7-a14e-682ce3dbd00b', 'fb4c2a3e-5dc1-4ee9-b6d6-5291a59465eb', 'c7fc94f5-471c-48c4-8385-126efafa3e3f', 13, 544.00, 7072.00, '2026-03-29 01:06:06.365348+00', 0.00),
	('19abf1a8-448d-4c60-8722-b4f84ff6915d', 'fb4c2a3e-5dc1-4ee9-b6d6-5291a59465eb', '4df4d69c-9c2f-4221-8816-5eae1947bd96', 1, 12.00, 12.00, '2026-03-29 01:06:06.365348+00', 0.00),
	('627dc05d-2226-4353-8368-4f631df2c831', '2d9e8bf7-ed2f-44c3-96b5-1e707ce8f156', 'c7fc94f5-471c-48c4-8385-126efafa3e3f', 1, 5443.00, 5443.00, '2026-03-29 01:09:30.943581+00', 0.00),
	('b4d9eb35-3e6a-424e-b812-13403711d8c3', '4dece1dd-e707-416b-a273-c5ad3a246371', '0427ab34-b940-49de-9de3-e2127a25070c', 1, 120.00, 120.00, '2026-03-31 21:50:42.322022+00', 0.00),
	('5b889a6a-65d1-4ad5-abe7-92f9521ffc33', '41986349-acd7-499a-8cd2-5b4edddffba4', '0427ab34-b940-49de-9de3-e2127a25070c', 2, 120.00, 240.00, '2026-03-31 22:13:59.001721+00', 0.00),
	('27a27ef5-ad49-4096-84bd-39116dbe833e', '0cc744da-3049-4770-9efb-63a32061b9bf', '0427ab34-b940-49de-9de3-e2127a25070c', 2, 120.00, 240.00, '2026-03-31 22:14:38.296054+00', 0.00),
	('6b4813ac-2ca6-441d-98b0-69745671d772', 'c45005fd-e17c-41a4-b720-ed7d4a78d332', '0427ab34-b940-49de-9de3-e2127a25070c', 2, 120.00, 240.00, '2026-03-31 22:14:48.84816+00', 0.00),
	('6b1e286d-7297-496f-b982-533118e59cde', '3db56bd1-2707-4759-afc5-2c81dd0545c4', 'c7fc94f5-471c-48c4-8385-126efafa3e3f', 1, 544.00, 544.00, '2026-03-31 22:29:52.454891+00', 0.00),
	('d2308966-3f55-4be6-a874-22eaaf58b064', 'fce7f76d-6937-46bb-8bc3-71002b626f4b', 'c7fc94f5-471c-48c4-8385-126efafa3e3f', 1, 544.00, 544.00, '2026-03-31 22:44:06.653147+00', 0.00),
	('e0cd1f55-1c2b-464c-b55a-fb78b89f39a8', 'b750534c-d423-437c-8d43-2700338ce07e', 'c7fc94f5-471c-48c4-8385-126efafa3e3f', 1, 544.00, 544.00, '2026-03-31 22:47:38.511465+00', 0.00),
	('15783a4e-e76e-4a5c-adab-e81214fd6356', '65388b17-59d4-4a18-bb75-caa49644d66d', 'c7fc94f5-471c-48c4-8385-126efafa3e3f', 1, 544.00, 544.00, '2026-03-31 23:06:28.072375+00', 0.00),
	('9d83545c-531b-4522-9cdc-01387c7ea9e4', '7203a5f1-d1fb-4665-abf2-21ee91086ca5', 'c7fc94f5-471c-48c4-8385-126efafa3e3f', 1, 544.00, 544.00, '2026-03-31 23:06:54.668154+00', 0.00),
	('78694328-715b-43b6-a6cd-2c7f1e7be533', 'bff051c9-9954-4e15-9191-38d501dcbb1b', 'c7fc94f5-471c-48c4-8385-126efafa3e3f', 1, 544.00, 544.00, '2026-03-31 23:23:21.889125+00', 0.00),
	('60c3e783-9d76-4bc3-bd2b-d38c9c558737', '46baeabf-bbd9-4afa-988b-6c204dc9a253', 'c7fc94f5-471c-48c4-8385-126efafa3e3f', 1, 544.00, 544.00, '2026-03-31 23:23:53.113796+00', 0.00),
	('113eec77-f158-4484-9865-91e14bd87e73', '9b4cf31f-a2e0-4bbd-af84-07376f0dddfa', 'c7fc94f5-471c-48c4-8385-126efafa3e3f', 1, 544.00, 544.00, '2026-03-31 23:38:47.7678+00', 0.00),
	('128e8388-58ff-4bc4-b157-4042cbc2f9d0', 'c0f1704a-0587-41c1-8cdc-13cf41d71446', 'c7fc94f5-471c-48c4-8385-126efafa3e3f', 1, 544.00, 544.00, '2026-04-01 00:03:14.106774+00', 0.00),
	('a359bc3d-71a1-47c4-bc61-a48f6e3acc00', '0c8182d1-244c-44c7-b8ad-a98697ad5bdd', 'c7fc94f5-471c-48c4-8385-126efafa3e3f', 1, 544.00, 544.00, '2026-04-01 22:27:53.824462+00', 0.00),
	('7ed55123-40bb-4ce6-b127-25159edbf686', '46002391-dd3b-4983-92cd-c6cee34a8eca', '4df4d69c-9c2f-4221-8816-5eae1947bd96', 12, 12.00, 144.00, '2026-04-01 22:29:21.342947+00', 0.00),
	('1c93189a-72d3-4da0-a2fb-c5a5e98030aa', 'fef6ef84-ff47-4b69-83d5-7db75bdd0fab', 'c7fc94f5-471c-48c4-8385-126efafa3e3f', 1, 544.00, 544.00, '2026-04-02 00:18:56.00549+00', 0.00),
	('52327eed-8d3c-478a-b73c-68c217178caa', '90334559-1459-4a79-beb5-01a76ad51f9d', 'c7fc94f5-471c-48c4-8385-126efafa3e3f', 1, 544.00, 544.00, '2026-04-02 00:20:05.866102+00', 0.00),
	('34cfd43a-0399-4167-b700-c28cf6f0f20a', '5067510d-8cf8-4e95-84e1-68136d1e9ae7', 'c7fc94f5-471c-48c4-8385-126efafa3e3f', 1, 544.00, 544.00, '2026-04-02 01:27:45.707494+00', 0.00),
	('75ed4b43-1508-48d5-8fcc-a6b50159ea2e', 'fdaa4a83-19af-4420-9410-66c649612905', 'c7fc94f5-471c-48c4-8385-126efafa3e3f', 1, 544.00, 544.00, '2026-04-02 01:35:05.588917+00', 0.00),
	('4277dcfd-bee2-4aa2-b047-30c4e6489e42', 'abab5267-cd88-43ef-942f-54020fd5e54f', 'c7fc94f5-471c-48c4-8385-126efafa3e3f', 1, 544.00, 544.00, '2026-04-02 01:52:43.097112+00', 0.00),
	('3d5b03fe-69e2-449b-b05e-051c506cb002', '92b40023-af9c-43a1-9ea7-aed1265a3259', 'c7fc94f5-471c-48c4-8385-126efafa3e3f', 1, 544.00, 544.00, '2026-04-02 01:54:30.278017+00', 0.00),
	('e514ee83-e26c-4008-b2d2-3d31bf5eba00', '164ff500-0ea5-4eb5-afd5-084b1ab48f14', 'c7fc94f5-471c-48c4-8385-126efafa3e3f', 1, 544.00, 544.00, '2026-04-02 03:06:51.133301+00', 0.00),
	('153cd08f-54fe-42fb-bf8e-ce760f86277e', '65ad992a-770c-4ec2-95bb-feaa4ea81806', 'c7fc94f5-471c-48c4-8385-126efafa3e3f', 10, 544.00, 5440.00, '2026-04-02 03:21:17.180148+00', 0.00),
	('2d938d22-7ddb-4fc3-ad7f-54aa698c0657', '2d662acf-740d-434b-aabc-f1fcf82515e1', 'c7fc94f5-471c-48c4-8385-126efafa3e3f', 1, 544.00, 544.00, '2026-04-02 03:35:37.934986+00', 0.00),
	('63b9b931-fa50-445c-8905-700f9ecf8a5e', '40666a26-dfca-4b19-b22a-53096124ecbc', 'c7fc94f5-471c-48c4-8385-126efafa3e3f', 1, 544.00, 544.00, '2026-04-02 10:03:50.857819+00', 0.00),
	('a2d41264-0cf0-4913-9d05-2e689205e10c', '338b175f-c2f3-4074-9d9d-0fdd7fa9418c', 'c7fc94f5-471c-48c4-8385-126efafa3e3f', 1, 544.00, 544.00, '2026-04-02 10:09:54.421239+00', 0.00),
	('0dd89445-9e96-4dce-baa5-e6cdededec2b', 'a95c140f-32fa-4b76-96aa-5728a190406a', 'c7fc94f5-471c-48c4-8385-126efafa3e3f', 1, 544.00, 544.00, '2026-04-02 10:29:44.46549+00', 0.00),
	('864b5662-417d-42dd-a1b1-14db187a65fc', '101ed81f-d220-434a-a216-d2aeeb8a395a', 'c7fc94f5-471c-48c4-8385-126efafa3e3f', 1, 544.00, 544.00, '2026-04-02 19:09:49.558339+00', 0.00),
	('a18726ed-5bdd-418b-982b-d8402c2bd218', 'a539c1fc-561d-4c55-8f7c-65a7e89bd43b', 'c7fc94f5-471c-48c4-8385-126efafa3e3f', 1, 544.00, 544.00, '2026-04-02 19:25:19.828778+00', 0.00),
	('7c601a1f-3e9a-42bb-be8e-3ad1f51daf28', 'd301035b-1b48-4f7a-90fb-88a0e2e3070c', 'c7fc94f5-471c-48c4-8385-126efafa3e3f', 1, 544.00, 544.00, '2026-04-02 19:34:54.171728+00', 0.00),
	('9c57952d-3944-4fee-b102-6c37f344580a', '2658f5ce-51d2-44df-834b-9b2065547dd5', 'c7fc94f5-471c-48c4-8385-126efafa3e3f', 1, 544.00, 544.00, '2026-04-02 19:58:46.350081+00', 0.00),
	('bff48a81-cd73-42a3-ab7e-c94d1d5930c2', 'eef3675a-9783-4526-a383-fa1956cff02c', 'c7fc94f5-471c-48c4-8385-126efafa3e3f', 1, 544.00, 544.00, '2026-04-02 20:01:17.395365+00', 0.00),
	('ab37b6a9-8c07-43e0-a303-86032b7d3db7', '1f3ec53c-8b0f-4d27-8a2d-90f449263b35', 'c7fc94f5-471c-48c4-8385-126efafa3e3f', 1, 544.00, 544.00, '2026-04-02 20:16:20.760332+00', 0.00),
	('f5dc576b-ee55-482f-babb-d7825d87e21f', '8cd2a495-515c-4eb6-9246-c5ab84a6f5a3', 'c7fc94f5-471c-48c4-8385-126efafa3e3f', 1, 544.00, 544.00, '2026-04-03 18:23:47.396985+00', 0.00),
	('6d539c56-b531-4e64-888d-8f51ca49a3fb', 'ca755135-040a-4c66-bf92-05549232ea6b', 'c7fc94f5-471c-48c4-8385-126efafa3e3f', 1, 544.00, 544.00, '2026-04-03 20:21:40.037881+00', 0.00),
	('1cd8af32-5fd9-45a9-990d-efb3eccf15ac', '5b21ce4e-42c4-4c09-bc4e-e7336f064a66', 'c7fc94f5-471c-48c4-8385-126efafa3e3f', 10, 544.00, 5440.00, '2026-04-03 22:13:40.280936+00', 0.00),
	('62b4db37-3eec-4507-9c46-4c6a74ced675', '29582a30-7354-4830-809f-c5472e9319aa', 'c7fc94f5-471c-48c4-8385-126efafa3e3f', 1, 544.00, 544.00, '2026-04-03 23:21:12.976788+00', 0.00),
	('6122c7fe-9df0-4837-b76a-80b9f4bec6b2', '7569308c-b7c6-4d9f-80fa-c150b620798a', '38e5be56-bbc6-45af-ae50-f9569bfe6ca3', 15, 345.00, 5175.00, '2026-04-04 13:55:26.225933+00', 0.00),
	('c00a692b-73b2-4813-996c-6000a7d660e7', '0c9183c4-9d0e-48bc-949f-da42edecd089', 'c7fc94f5-471c-48c4-8385-126efafa3e3f', 1, 544.00, 544.00, '2026-04-07 20:11:59.78067+00', 0.00),
	('2f72c9b0-9061-49ac-8682-a56198575e6b', '730094e4-acde-4f04-b75d-98be180f2d66', 'c7fc94f5-471c-48c4-8385-126efafa3e3f', 1, 544.00, 544.00, '2026-04-07 20:15:17.579376+00', 0.00),
	('f3ae9d16-ae33-4d8b-83eb-54669c33c8de', 'b8b86194-5549-4454-8ed0-fcc29265a463', 'c7fc94f5-471c-48c4-8385-126efafa3e3f', 1, 544.00, 544.00, '2026-04-07 22:51:46.929597+00', 0.00),
	('9d1ee6d9-4e30-4588-a62f-1c612d7934e5', '4b687a20-9b84-44c0-97ea-3de9f6d43e37', 'c7fc94f5-471c-48c4-8385-126efafa3e3f', 1, 544.00, 544.00, '2026-04-08 02:30:49.899588+00', 0.00),
	('c013e5d4-5f09-4083-943d-e1753d0d5854', '6d2e97d7-d05b-4028-aab8-fda2ed42f6de', 'c7fc94f5-471c-48c4-8385-126efafa3e3f', 1, 544.00, 544.00, '2026-04-08 02:58:08.037664+00', 0.00),
	('c4dcff18-432f-4305-a326-d525f2e013cd', 'b5b31103-6df2-4614-b1d0-1e5130db5b9e', 'c7fc94f5-471c-48c4-8385-126efafa3e3f', 1, 544.00, 544.00, '2026-04-09 23:40:49.366317+00', 0.00),
	('e7c86627-3dcd-485a-9ff6-62eedfa11415', '379b1388-e18c-4e71-a9cc-db957bb5cbd8', 'c7fc94f5-471c-48c4-8385-126efafa3e3f', 1, 544.00, 544.00, '2026-04-09 23:41:22.552233+00', 0.00),
	('7e134220-470b-4c20-97c1-2f09c5fefe23', '0a7813f6-15c9-4d9e-a432-15b6770f51e7', '85b8a723-eb11-46a2-84a2-938567295b42', 2, 10.00, 20.00, '2026-04-10 00:34:20.875735+00', 0.00),
	('d319d3d1-425d-434e-bf11-8a2750e70b0f', '0a7813f6-15c9-4d9e-a432-15b6770f51e7', 'd801a523-4fea-46ae-82bb-b72d693d7d79', 3, 11.00, 33.00, '2026-04-10 00:34:20.875735+00', 0.00),
	('b5b25585-5661-4983-9e36-211d0979cb17', '0a7813f6-15c9-4d9e-a432-15b6770f51e7', '76c4b15f-dd30-404c-92eb-12f3fabf3149', 4, 12.00, 48.00, '2026-04-10 00:34:20.875735+00', 0.00),
	('4587756b-3bdf-43bd-ad4d-761518f1464e', '0a7813f6-15c9-4d9e-a432-15b6770f51e7', 'cab1e4f8-6d00-4f5a-98d5-c442461c70d7', 3, 12.00, 36.00, '2026-04-10 00:34:20.875735+00', 0.00),
	('2aafe794-dca3-4eb0-b694-7a23201ddc0e', '0a7813f6-15c9-4d9e-a432-15b6770f51e7', '4e26bebe-7a8e-4992-989f-8a1547bb90e1', 2, 12.00, 24.00, '2026-04-10 00:34:20.875735+00', 0.00),
	('5af9b94b-a649-4ef4-9cea-3d2c6cdae9c0', '0a7813f6-15c9-4d9e-a432-15b6770f51e7', '33634e7b-ac77-471d-98dd-c67b812d6259', 1, 12.00, 12.00, '2026-04-10 00:34:20.875735+00', 0.00),
	('970d49f6-c085-45cb-98ee-d8b8dfc8a708', '99d3d730-b671-4f57-ab19-04d83dfb92b3', '85b8a723-eb11-46a2-84a2-938567295b42', 2, 12.00, 24.00, '2026-04-10 00:34:21.995413+00', 0.00),
	('b8560c1c-5289-4288-a1c1-d55be4dca44a', '99d3d730-b671-4f57-ab19-04d83dfb92b3', 'd801a523-4fea-46ae-82bb-b72d693d7d79', 3, 221.00, 663.00, '2026-04-10 00:34:21.995413+00', 0.00),
	('e2214263-5c68-497d-ab1c-9c290850dc3f', '99d3d730-b671-4f57-ab19-04d83dfb92b3', '0cad7111-0399-4524-8f29-eedaa64c4106', 4, 12.00, 48.00, '2026-04-10 00:34:21.995413+00', 0.00),
	('f32745fc-5e1c-45bb-aed2-7c113870a024', '99d3d730-b671-4f57-ab19-04d83dfb92b3', '8c5a9dff-4603-48a2-bf14-53d80d586c4c', 3, 12.00, 36.00, '2026-04-10 00:34:21.995413+00', 0.00),
	('f6460862-9d88-4270-a6eb-c7fe694924f7', 'e641a504-cda5-4e73-b335-b68944c0e696', '85b8a723-eb11-46a2-84a2-938567295b42', 2, 10.00, 20.00, '2026-04-10 00:35:03.489468+00', 0.00),
	('8f635ef3-3dc2-4acc-987d-de7781751484', 'e641a504-cda5-4e73-b335-b68944c0e696', 'd801a523-4fea-46ae-82bb-b72d693d7d79', 3, 11.00, 33.00, '2026-04-10 00:35:03.489468+00', 0.00),
	('909dbef6-0f63-4074-aafb-101e217de8d3', 'e641a504-cda5-4e73-b335-b68944c0e696', '76c4b15f-dd30-404c-92eb-12f3fabf3149', 4, 12.00, 48.00, '2026-04-10 00:35:03.489468+00', 0.00),
	('9449e7ac-158d-4ed3-b81b-cfae1fcdc5b0', 'e641a504-cda5-4e73-b335-b68944c0e696', 'cab1e4f8-6d00-4f5a-98d5-c442461c70d7', 3, 12.00, 36.00, '2026-04-10 00:35:03.489468+00', 0.00),
	('c59f78c6-741c-4aff-b995-94283dd22945', 'e641a504-cda5-4e73-b335-b68944c0e696', '4e26bebe-7a8e-4992-989f-8a1547bb90e1', 2, 12.00, 24.00, '2026-04-10 00:35:03.489468+00', 0.00),
	('101b5870-b2e6-4240-a7c5-641b13bdf59a', 'e641a504-cda5-4e73-b335-b68944c0e696', '33634e7b-ac77-471d-98dd-c67b812d6259', 1, 12.00, 12.00, '2026-04-10 00:35:03.489468+00', 0.00),
	('32896992-9c06-41e3-8d1a-0821229b3a69', '092162ea-b0ba-42f2-a179-7fa8b85180f7', '85b8a723-eb11-46a2-84a2-938567295b42', 2, 12.00, 24.00, '2026-04-10 00:35:04.356312+00', 0.00),
	('a2ca063e-4b1e-4cd1-a561-f6d52c26ec81', '092162ea-b0ba-42f2-a179-7fa8b85180f7', 'd801a523-4fea-46ae-82bb-b72d693d7d79', 3, 221.00, 663.00, '2026-04-10 00:35:04.356312+00', 0.00),
	('3d985466-39ce-4266-8871-ba0126e0d236', '092162ea-b0ba-42f2-a179-7fa8b85180f7', '0cad7111-0399-4524-8f29-eedaa64c4106', 4, 12.00, 48.00, '2026-04-10 00:35:04.356312+00', 0.00),
	('4ea72134-b84b-43c4-8dc4-fd58b98386a6', '092162ea-b0ba-42f2-a179-7fa8b85180f7', '8c5a9dff-4603-48a2-bf14-53d80d586c4c', 3, 12.00, 36.00, '2026-04-10 00:35:04.356312+00', 0.00),
	('70b55273-742b-4326-b868-a3fb13db4129', 'a2928706-a242-4480-9c0a-040276e6353a', '85b8a723-eb11-46a2-84a2-938567295b42', 2, 10.00, 20.00, '2026-04-10 00:36:40.527045+00', 0.00),
	('4e6a8bc6-7b23-4350-bd15-b6387921b174', 'a2928706-a242-4480-9c0a-040276e6353a', 'd801a523-4fea-46ae-82bb-b72d693d7d79', 3, 11.00, 33.00, '2026-04-10 00:36:40.527045+00', 0.00),
	('859e295c-757f-496c-8a4b-b572c30f8c16', 'a2928706-a242-4480-9c0a-040276e6353a', '76c4b15f-dd30-404c-92eb-12f3fabf3149', 4, 12.00, 48.00, '2026-04-10 00:36:40.527045+00', 0.00),
	('007ca3e9-bf65-410c-bb21-a24b6244bd2f', 'a2928706-a242-4480-9c0a-040276e6353a', 'cab1e4f8-6d00-4f5a-98d5-c442461c70d7', 3, 12.00, 36.00, '2026-04-10 00:36:40.527045+00', 0.00),
	('378f24b2-8ffc-4e01-9085-76cbb0af1d7d', 'a2928706-a242-4480-9c0a-040276e6353a', '4e26bebe-7a8e-4992-989f-8a1547bb90e1', 2, 12.00, 24.00, '2026-04-10 00:36:40.527045+00', 0.00),
	('d15e9b6a-d63d-4166-a4d0-8124c7c0c610', 'a2928706-a242-4480-9c0a-040276e6353a', '33634e7b-ac77-471d-98dd-c67b812d6259', 1, 12.00, 12.00, '2026-04-10 00:36:40.527045+00', 0.00),
	('77e7d1ac-b991-44de-a2ab-0efe6c7bb60a', '3655734a-2b6d-448e-a66d-7a5cf1524a84', '85b8a723-eb11-46a2-84a2-938567295b42', 2, 12.00, 24.00, '2026-04-10 00:36:41.386499+00', 0.00),
	('7f1b66f1-74b5-45f5-96cc-a6af1c25a851', '3655734a-2b6d-448e-a66d-7a5cf1524a84', 'd801a523-4fea-46ae-82bb-b72d693d7d79', 3, 221.00, 663.00, '2026-04-10 00:36:41.386499+00', 0.00),
	('8ef6aeff-e6f0-4d41-8750-221eb160afe9', '3655734a-2b6d-448e-a66d-7a5cf1524a84', '0cad7111-0399-4524-8f29-eedaa64c4106', 4, 12.00, 48.00, '2026-04-10 00:36:41.386499+00', 0.00),
	('8c1566d8-c279-46ed-90a2-78aa16ee6b00', '3655734a-2b6d-448e-a66d-7a5cf1524a84', '8c5a9dff-4603-48a2-bf14-53d80d586c4c', 3, 12.00, 36.00, '2026-04-10 00:36:41.386499+00', 0.00),
	('80a50122-4087-42ca-9ae1-ac974baacca5', 'e01bb57c-6141-4b31-88c3-4723cb67da7a', '85b8a723-eb11-46a2-84a2-938567295b42', 2, 10.00, 20.00, '2026-04-10 00:46:33.62852+00', 0.00),
	('5b92221a-984e-4d44-98ef-86ea43bde427', 'e01bb57c-6141-4b31-88c3-4723cb67da7a', 'd801a523-4fea-46ae-82bb-b72d693d7d79', 3, 11.00, 33.00, '2026-04-10 00:46:33.62852+00', 0.00),
	('3d8ab5a2-8cc7-42d7-99e1-289df56ac994', 'e01bb57c-6141-4b31-88c3-4723cb67da7a', '76c4b15f-dd30-404c-92eb-12f3fabf3149', 4, 12.00, 48.00, '2026-04-10 00:46:33.62852+00', 0.00),
	('4b3eee81-1cf8-42dc-bd81-acf9ee140b17', 'e01bb57c-6141-4b31-88c3-4723cb67da7a', 'cab1e4f8-6d00-4f5a-98d5-c442461c70d7', 3, 12.00, 36.00, '2026-04-10 00:46:33.62852+00', 0.00),
	('c1b4a798-c57d-4078-b6ee-2bdba35ac65e', 'e01bb57c-6141-4b31-88c3-4723cb67da7a', '4e26bebe-7a8e-4992-989f-8a1547bb90e1', 2, 12.00, 24.00, '2026-04-10 00:46:33.62852+00', 0.00),
	('03892da5-d5a3-4793-bf6c-e6bb79e24566', 'e01bb57c-6141-4b31-88c3-4723cb67da7a', '33634e7b-ac77-471d-98dd-c67b812d6259', 1, 12.00, 12.00, '2026-04-10 00:46:33.62852+00', 0.00),
	('127ac1a1-d496-488b-adea-226598032e1e', 'bf119e3a-ca32-43a8-b431-eaeec8e91068', '85b8a723-eb11-46a2-84a2-938567295b42', 2, 12.00, 24.00, '2026-04-10 00:46:34.792166+00', 0.00),
	('1d359c4d-e41e-4daf-8c45-38d9ed86f5a4', 'bf119e3a-ca32-43a8-b431-eaeec8e91068', 'd801a523-4fea-46ae-82bb-b72d693d7d79', 3, 221.00, 663.00, '2026-04-10 00:46:34.792166+00', 0.00),
	('a35e7208-7cb8-4e9d-94ee-3bec8415b0f6', 'bf119e3a-ca32-43a8-b431-eaeec8e91068', '0cad7111-0399-4524-8f29-eedaa64c4106', 4, 12.00, 48.00, '2026-04-10 00:46:34.792166+00', 0.00),
	('555b5c12-d6a8-49b5-b9a4-08abf6f0a2fc', 'bf119e3a-ca32-43a8-b431-eaeec8e91068', '8c5a9dff-4603-48a2-bf14-53d80d586c4c', 3, 12.00, 36.00, '2026-04-10 00:46:34.792166+00', 0.00);


--
-- Data for Name: order_payments; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."order_payments" ("id", "order_id", "payment_method", "amount", "created_at") VALUES
	('a295ef6a-440f-4e04-9a9e-f1089718befa', 'd05ce3f4-ef91-488a-8237-35a3307f2001', 'cash', 32.00, '2026-03-14 14:40:58.893814+00'),
	('933692d5-f425-458b-9dd4-0eaf3b56cc53', '2aec1109-d9b7-433a-8106-22ad13090685', 'cash', 45.00, '2026-03-28 23:52:56.342975+00'),
	('c3fe99fd-85a0-4f18-a74a-158536ec41de', '1fba40f7-6193-4f3e-91c7-ab141e109f43', 'cash', 134.00, '2026-03-29 00:29:05.586325+00'),
	('9ff53ea9-69ad-49e9-b110-3750b2d18807', 'a48a508a-7239-4e6b-a43f-3fcd4c9a92cd', 'cash', 544.00, '2026-03-29 00:54:59.575594+00'),
	('dc967300-bc13-4621-a048-65b04dffe9a0', 'c45005fd-e17c-41a4-b720-ed7d4a78d332', 'cash', 10.00, '2026-03-31 22:14:49.497722+00'),
	('6bb0902c-9d9d-429b-b421-b83bf972b53d', '3db56bd1-2707-4759-afc5-2c81dd0545c4', 'cash', 10.00, '2026-03-31 22:29:53.225242+00'),
	('9a75d516-f2bf-4a5b-9e57-f45ef96b575d', 'fce7f76d-6937-46bb-8bc3-71002b626f4b', 'cash', 32.00, '2026-03-31 22:44:07.176109+00'),
	('2b36812f-f0d0-4187-a64b-e31ae1007cc6', 'b750534c-d423-437c-8d43-2700338ce07e', 'cash', 100.00, '2026-03-31 22:47:38.992601+00'),
	('b4e08150-ce08-40f1-ac0e-10b77adb62e9', '7203a5f1-d1fb-4665-abf2-21ee91086ca5', 'cash', 200.00, '2026-03-31 23:06:55.114296+00'),
	('e397656b-2480-4131-833c-e5ccf9c7edf4', 'bff051c9-9954-4e15-9191-38d501dcbb1b', 'cash', 510.00, '2026-03-31 23:23:22.773687+00'),
	('872a4c79-eeaa-4fe3-b867-9f8d4ff9859d', '46baeabf-bbd9-4afa-988b-6c204dc9a253', 'cash', 344.00, '2026-03-31 23:23:53.495163+00'),
	('86545247-e871-46d9-bf69-68a49408b444', 'd05ce3f4-ef91-488a-8237-35a3307f2001', 'visa', 313.00, '2026-03-14 14:40:58.893814+00'),
	('eb9b34c6-031a-4869-bce6-72519eb0d952', '2aec1109-d9b7-433a-8106-22ad13090685', 'visa', 43.00, '2026-03-28 23:52:56.342975+00'),
	('ea869d47-44bf-408d-8450-4bdc3f228123', '2d9e8bf7-ed2f-44c3-96b5-1e707ce8f156', 'visa', 45.00, '2026-03-30 01:47:23.530526+00'),
	('3485b6c3-8abb-4c34-9d02-00af02adc39b', '3db56bd1-2707-4759-afc5-2c81dd0545c4', 'visa', 10.00, '2026-03-31 22:29:53.225242+00'),
	('781d20ac-1590-485c-8746-03c8ac5d53b7', 'fce7f76d-6937-46bb-8bc3-71002b626f4b', 'visa', 23.00, '2026-03-31 22:44:07.176109+00'),
	('cfbc5c63-4792-4313-b780-a399191210b0', 'b750534c-d423-437c-8d43-2700338ce07e', 'visa', 100.00, '2026-03-31 22:47:38.992601+00'),
	('1fa9bb9c-e7a1-4b8c-90ed-3cc6e9246398', '7203a5f1-d1fb-4665-abf2-21ee91086ca5', 'visa', 400.00, '2026-03-31 23:06:55.114296+00'),
	('ca02dfde-e2fb-4aa2-a1e2-cceb1ca4cfd0', 'bff051c9-9954-4e15-9191-38d501dcbb1b', 'visa', 34.00, '2026-03-31 23:23:22.773687+00'),
	('7a136527-6355-4277-a73e-34c43408c1be', 'c0f1704a-0587-41c1-8cdc-13cf41d71446', 'cash', 544.00, '2026-04-01 00:03:14.55633+00'),
	('62ed37a7-5312-422a-9703-ed0334ad1aab', '0c8182d1-244c-44c7-b8ad-a98697ad5bdd', 'visa', 544.00, '2026-04-01 22:27:54.194328+00'),
	('56096c16-1e4f-4baa-9f2f-a777ef891048', '46002391-dd3b-4983-92cd-c6cee34a8eca', 'cash', 144.00, '2026-04-01 22:29:21.626847+00'),
	('5e895ffd-493c-4c19-8bb2-c1a02fd83fe0', '90334559-1459-4a79-beb5-01a76ad51f9d', 'cash', 100.00, '2026-04-02 00:20:06.257026+00'),
	('fd3511fc-96bc-441c-9ad4-8f26f2524341', '90334559-1459-4a79-beb5-01a76ad51f9d', 'visa', 100.00, '2026-04-02 00:20:06.257026+00'),
	('099c0880-d31f-4eb5-815f-5619335a41e3', '5067510d-8cf8-4e95-84e1-68136d1e9ae7', 'cash', 100.00, '2026-04-02 01:27:46.2724+00'),
	('3d859cf1-f3fe-41a0-b3c1-798b35386bda', 'abab5267-cd88-43ef-942f-54020fd5e54f', 'instapay', 544.00, '2026-04-02 01:52:43.339405+00'),
	('e195c6fa-05de-4805-acd5-a07034d5ffd2', '92b40023-af9c-43a1-9ea7-aed1265a3259', 'cash', 544.00, '2026-04-02 01:54:30.543022+00'),
	('b319299c-39c9-4e23-971c-d016133be1b0', '8cd2a495-515c-4eb6-9246-c5ab84a6f5a3', 'cash', 100.00, '2026-04-03 18:23:47.889526+00'),
	('b702f1ca-3c92-47d6-9cd5-c98ebb197363', '8cd2a495-515c-4eb6-9246-c5ab84a6f5a3', 'visa', 100.00, '2026-04-03 18:23:47.889526+00'),
	('93a274eb-2187-4fcb-91f8-59a775281e7b', '8cd2a495-515c-4eb6-9246-c5ab84a6f5a3', 'cheque', 344.00, '2026-04-03 18:23:47.889526+00'),
	('87784c4e-a612-4507-be51-2893339fe1be', 'ca755135-040a-4c66-bf92-05549232ea6b', 'cash', 544.00, '2026-04-03 20:21:40.483434+00'),
	('4b83a4f8-fc84-4325-99b8-d95ceba01cdb', '29582a30-7354-4830-809f-c5472e9319aa', 'cash', 44.00, '2026-04-03 23:21:13.390794+00'),
	('724ce5d5-4932-4c47-a0cf-aba648234bcc', '7569308c-b7c6-4d9f-80fa-c150b620798a', 'cash', 5175.00, '2026-04-04 13:55:26.840539+00'),
	('7d39f784-f2f2-4e50-9796-3f11b5468e6b', 'b5b31103-6df2-4614-b1d0-1e5130db5b9e', 'cheque', 544.00, '2026-04-09 23:40:49.839703+00'),
	('3cf4d500-05d2-4c03-8d9c-03d74ccabe0d', '379b1388-e18c-4e71-a9cc-db957bb5cbd8', 'cash', 544.00, '2026-04-09 23:41:22.788702+00');


--
-- Data for Name: payment_installments; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."payment_installments" ("id", "order_id", "method", "amount", "note", "created_at") VALUES
	('bef00324-ae36-442f-afc0-551c490d154a', 'd05ce3f4-ef91-488a-8237-35a3307f2001', 'cash', 32.00, NULL, '2026-03-28 23:37:30.069474+00'),
	('4f293ef5-f8dd-43ef-b35f-1bc0ff9f7025', '2aec1109-d9b7-433a-8106-22ad13090685', 'cash', 45.00, NULL, '2026-03-28 23:52:56.090942+00'),
	('4aba50a3-466c-4377-b70c-29b54d827e04', '1fba40f7-6193-4f3e-91c7-ab141e109f43', 'cash', 134.00, NULL, '2026-03-29 00:29:05.470373+00'),
	('e832b708-278a-4cfa-861d-61dcb6d9e1e3', 'a48a508a-7239-4e6b-a43f-3fcd4c9a92cd', 'cash', 544.00, NULL, '2026-03-29 00:54:59.360481+00'),
	('49e09152-e901-4455-9bb0-c0ddcf8f19f1', 'c45005fd-e17c-41a4-b720-ed7d4a78d332', 'cash', 10.00, NULL, '2026-03-31 22:14:49.148098+00'),
	('5068283d-7404-41b6-b9b0-5bafa18f04d5', '3db56bd1-2707-4759-afc5-2c81dd0545c4', 'cash', 10.00, NULL, '2026-03-31 22:29:52.824611+00'),
	('40c08263-7291-4aa0-887c-370701238e8b', 'fce7f76d-6937-46bb-8bc3-71002b626f4b', 'cash', 32.00, NULL, '2026-03-31 22:44:06.934015+00'),
	('3c30d6a9-d98e-44fd-820b-4bb87bcc1f28', 'b750534c-d423-437c-8d43-2700338ce07e', 'cash', 100.00, NULL, '2026-03-31 22:47:38.728291+00'),
	('8b74fc5b-6cb9-4ed7-9525-edfb182b9de9', '7203a5f1-d1fb-4665-abf2-21ee91086ca5', 'cash', 200.00, NULL, '2026-03-31 23:06:54.887786+00'),
	('cd82dba0-37f2-4c82-8bd0-649b219ed28e', 'bff051c9-9954-4e15-9191-38d501dcbb1b', 'cash', 510.00, NULL, '2026-03-31 23:23:22.373242+00'),
	('ba5988b5-cac5-462f-a564-7ece2658ede4', '46baeabf-bbd9-4afa-988b-6c204dc9a253', 'cash', 344.00, NULL, '2026-03-31 23:23:53.279319+00'),
	('7475d78a-877b-4d86-a3e2-c9ca035c1e0c', 'd05ce3f4-ef91-488a-8237-35a3307f2001', 'visa', 313.00, NULL, '2026-03-28 23:37:30.069474+00'),
	('5e78281d-5edb-451c-a2da-d21c52a24ebe', '2aec1109-d9b7-433a-8106-22ad13090685', 'visa', 43.00, NULL, '2026-03-28 23:52:56.090942+00'),
	('3e0e6dad-2bb7-483b-b86d-d623792761ee', '2d9e8bf7-ed2f-44c3-96b5-1e707ce8f156', 'visa', 45.00, NULL, '2026-03-30 01:47:23.344511+00'),
	('c1f90cad-3a42-4878-aefe-0967b21bb564', '3db56bd1-2707-4759-afc5-2c81dd0545c4', 'visa', 10.00, NULL, '2026-03-31 22:29:52.824611+00'),
	('ae1f1548-11ee-49b2-a4aa-3b64c6fef13d', 'fce7f76d-6937-46bb-8bc3-71002b626f4b', 'visa', 23.00, NULL, '2026-03-31 22:44:06.934015+00'),
	('d9d893b4-e890-4aee-ab6b-40b698274274', 'b750534c-d423-437c-8d43-2700338ce07e', 'visa', 100.00, NULL, '2026-03-31 22:47:38.728291+00'),
	('c3db5b45-f37f-4b69-89d5-a842d7262b3d', '7203a5f1-d1fb-4665-abf2-21ee91086ca5', 'visa', 400.00, NULL, '2026-03-31 23:06:54.887786+00'),
	('336fe560-8804-4873-bd0a-ae870bf3e09b', 'bff051c9-9954-4e15-9191-38d501dcbb1b', 'visa', 34.00, NULL, '2026-03-31 23:23:22.373242+00'),
	('17ac2bcb-895d-42f7-a3ce-716446c68ed3', 'c0f1704a-0587-41c1-8cdc-13cf41d71446', 'cash', 544.00, NULL, '2026-04-01 00:03:14.352215+00'),
	('ccbc08fd-d2a7-4e4d-8b03-bc1a67875a6c', '0c8182d1-244c-44c7-b8ad-a98697ad5bdd', 'visa', 544.00, NULL, '2026-04-01 22:27:54.015159+00'),
	('fb819900-9187-45ba-bfe1-399c4c50d7b1', '46002391-dd3b-4983-92cd-c6cee34a8eca', 'cash', 144.00, NULL, '2026-04-01 22:29:21.48506+00'),
	('0a251674-639e-4101-b84d-f7aa3abb0d57', '90334559-1459-4a79-beb5-01a76ad51f9d', 'cash', 100.00, NULL, '2026-04-02 00:20:06.059671+00'),
	('79535cd1-a56a-47c7-95d4-a91f14092f7c', '90334559-1459-4a79-beb5-01a76ad51f9d', 'visa', 100.00, NULL, '2026-04-02 00:20:06.059671+00'),
	('c6a5d708-0b2d-432a-9226-35f947d679f0', '5067510d-8cf8-4e95-84e1-68136d1e9ae7', 'cash', 100.00, NULL, '2026-04-02 01:27:45.964709+00'),
	('600565d0-36ef-49ed-98ea-7dc7840333f8', 'abab5267-cd88-43ef-942f-54020fd5e54f', 'instapay', 544.00, NULL, '2026-04-02 01:52:43.223875+00'),
	('2f9bf968-a26e-4ffb-92ff-066bfc6037ec', '92b40023-af9c-43a1-9ea7-aed1265a3259', 'cash', 544.00, NULL, '2026-04-02 01:54:30.414792+00'),
	('2bcc52e0-a663-4e05-9ff0-c0cf5b6d9146', '8cd2a495-515c-4eb6-9246-c5ab84a6f5a3', 'cash', 100.00, NULL, '2026-04-03 18:23:47.637348+00'),
	('332cbb9c-5830-4d94-bc48-7bee4fccef2e', '8cd2a495-515c-4eb6-9246-c5ab84a6f5a3', 'visa', 100.00, NULL, '2026-04-03 18:23:47.637348+00'),
	('85bfc3ec-f659-4563-bfa0-dc6a68bc22f3', '8cd2a495-515c-4eb6-9246-c5ab84a6f5a3', 'cheque', 344.00, NULL, '2026-04-03 18:23:47.637348+00'),
	('337de311-3344-43a6-97ca-6fc5632e8520', 'ca755135-040a-4c66-bf92-05549232ea6b', 'cash', 544.00, NULL, '2026-04-03 20:21:40.237387+00'),
	('a5893fb1-3699-4f9b-9753-f639c8a2d63e', '29582a30-7354-4830-809f-c5472e9319aa', 'cash', 44.00, NULL, '2026-04-03 23:21:13.197092+00'),
	('6d1d3c6b-5232-4679-afb6-3daaf5603d60', '7569308c-b7c6-4d9f-80fa-c150b620798a', 'cash', 5175.00, NULL, '2026-04-04 13:55:26.58144+00'),
	('7ffc289e-c4f8-4f6d-914d-01beeabfa7cb', 'b5b31103-6df2-4614-b1d0-1e5130db5b9e', 'cheque', 544.00, NULL, '2026-04-09 23:40:49.648454+00'),
	('d67efd4f-8bc6-4df2-8702-4115fc13fca8', '379b1388-e18c-4e71-a9cc-db957bb5cbd8', 'cash', 544.00, NULL, '2026-04-09 23:41:22.676038+00');


--
-- Data for Name: product_price_history; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."product_price_history" ("id", "product_id", "recorded_at", "customer_price", "business_price", "cost_price") VALUES
	('6fa803a6-0d7b-4207-b680-a254c3ef159d', '0427ab34-b940-49de-9de3-e2127a25070c', '2026-04-03 17:48:00.013+00', 120.00, 100.00, 90.00),
	('75b1a6ae-1feb-4e2a-b8d3-479393b0acdd', 'c7fc94f5-471c-48c4-8385-126efafa3e3f', '2026-04-03 23:21:14.433+00', 544.00, 540.00, 334.00),
	('945df6f0-7169-4af5-bd1d-7627d302f7ec', '38e5be56-bbc6-45af-ae50-f9569bfe6ca3', '2026-04-04 15:04:57.008+00', 355.00, 350.00, 340.00),
	('e3796764-84d0-4a65-87f5-38d8638cddc6', '4df4d69c-9c2f-4221-8816-5eae1947bd96', '2026-04-01 22:29:22.48+00', 12.00, 9.00, 2.00),
	('1351a55c-485f-4a23-b59e-0edc00df5a8e', '38e5be56-bbc6-45af-ae50-f9569bfe6ca3', '2026-04-04 15:08:09.003539+00', 365.00, 360.00, 350.00),
	('a948f448-abae-4aff-ae8e-a4bf3e58b90a', '38e5be56-bbc6-45af-ae50-f9569bfe6ca3', '2026-04-04 15:08:39.011534+00', 355.00, 350.00, 340.00),
	('b1de533d-d24f-45e3-a8a6-d2c06aaa0938', 'c7fc94f5-471c-48c4-8385-126efafa3e3f', '2026-04-04 16:05:48.482974+00', 544.00, 540.00, 339.00),
	('2e1f5217-912f-4abd-ab83-021c991e71ac', '0427ab34-b940-49de-9de3-e2127a25070c', '2026-04-04 16:05:48.958342+00', 120.00, 100.00, 45.00),
	('e2aa661d-128a-4c90-a98d-8735a3ead7e3', 'c7fc94f5-471c-48c4-8385-126efafa3e3f', '2026-04-04 23:13:59.45837+00', 544.00, 540.00, 330.00),
	('558bdc26-6e50-4421-b67a-9e98c3b5f55f', 'c7fc94f5-471c-48c4-8385-126efafa3e3f', '2026-04-04 23:15:37.420975+00', 544.00, 540.00, 70.00),
	('baef2900-55e1-4dd3-98a5-ed7a0e9a7659', 'c7fc94f5-471c-48c4-8385-126efafa3e3f', '2026-04-04 23:24:03.672846+00', 544.00, 540.00, 35.00),
	('6ef79a9c-a264-4473-b156-e0a0ae13b8fe', '85b8a723-eb11-46a2-84a2-938567295b42', '2026-04-10 00:19:58.046342+00', 0.00, 0.00, 0.00),
	('44d664bc-ea66-4180-b36f-501bb9f3194c', 'd801a523-4fea-46ae-82bb-b72d693d7d79', '2026-04-10 00:19:58.445043+00', 0.00, 0.00, 0.00),
	('e9e08b96-f865-4120-a708-4575e097fc42', '76c4b15f-dd30-404c-92eb-12f3fabf3149', '2026-04-10 00:19:59.032454+00', 0.00, 0.00, 0.00),
	('8fbfff43-3de9-4c51-b59e-0c07d5fa6050', 'cab1e4f8-6d00-4f5a-98d5-c442461c70d7', '2026-04-10 00:19:59.372133+00', 0.00, 0.00, 0.00),
	('14c9a4dd-951d-4620-8ea9-ea6c36a20915', '4e26bebe-7a8e-4992-989f-8a1547bb90e1', '2026-04-10 00:20:00.041202+00', 0.00, 0.00, 0.00),
	('12199cb1-d09f-4de5-9b15-1b8e35cc8146', '33634e7b-ac77-471d-98dd-c67b812d6259', '2026-04-10 00:20:00.698981+00', 0.00, 0.00, 0.00),
	('3f415d16-5ed5-412d-ac24-c42569faa53e', '0cad7111-0399-4524-8f29-eedaa64c4106', '2026-04-10 00:20:01.473797+00', 0.00, 0.00, 0.00),
	('179e69ba-7e87-4d1f-b68b-cd7eff79f629', '8c5a9dff-4603-48a2-bf14-53d80d586c4c', '2026-04-10 00:20:01.802427+00', 0.00, 0.00, 0.00);


--
-- Data for Name: product_warehouse_stock; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."product_warehouse_stock" ("product_id", "warehouse_id", "quantity", "updated_at") VALUES
	('0427ab34-b940-49de-9de3-e2127a25070c', 1, 475, '2026-04-07 22:46:37.451888+00'),
	('4df4d69c-9c2f-4221-8816-5eae1947bd96', 1, 24, '2026-04-07 22:46:37.451888+00'),
	('38e5be56-bbc6-45af-ae50-f9569bfe6ca3', 1, 4, '2026-04-07 22:46:37.451888+00'),
	('c7fc94f5-471c-48c4-8385-126efafa3e3f', 1, 1241, '2026-04-09 23:40:51.609+00'),
	('c7fc94f5-471c-48c4-8385-126efafa3e3f', 2, 10, '2026-04-09 23:41:24.257+00'),
	('85b8a723-eb11-46a2-84a2-938567295b42', 1, 0, '2026-04-10 00:19:57.800201+00'),
	('d801a523-4fea-46ae-82bb-b72d693d7d79', 1, 0, '2026-04-10 00:19:58.311337+00'),
	('76c4b15f-dd30-404c-92eb-12f3fabf3149', 1, 0, '2026-04-10 00:19:58.871717+00'),
	('cab1e4f8-6d00-4f5a-98d5-c442461c70d7', 1, 0, '2026-04-10 00:19:59.25591+00'),
	('4e26bebe-7a8e-4992-989f-8a1547bb90e1', 1, 0, '2026-04-10 00:19:59.911175+00'),
	('33634e7b-ac77-471d-98dd-c67b812d6259', 1, 0, '2026-04-10 00:20:00.262342+00'),
	('0cad7111-0399-4524-8f29-eedaa64c4106', 1, 0, '2026-04-10 00:20:01.360454+00'),
	('8c5a9dff-4603-48a2-bf14-53d80d586c4c', 1, 0, '2026-04-10 00:20:01.691849+00');


--
-- Data for Name: profiles; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."profiles" ("id", "username", "is_admin", "feature_overrides", "created_at") VALUES
	('94cbb974-60af-4aa2-8787-fa3afebc8660', 'admin', true, '{}', '2026-04-10 02:07:48.947276+00'),
	('56647bc0-fd46-45b5-b97d-9899eb235904', 'ahmedhossam', false, '{"orders.hubNew": true, "payments.list": true, "sidebar.admin": false, "orders.hubList": true, "sidebar.orders": true, "sidebar.people": true, "brands.addBrand": true, "orders.editNote": true, "sidebar.control": false, "sidebar.reports": true, "brands.editBrand": true, "orders.exportCsv": true, "orders.importCsv": false, "people.addPerson": true, "register.deposit": true, "sidebar.payments": true, "sidebar.register": true, "orders.addPayment": true, "people.editPerson": true, "register.withdraw": true, "reports.exportCsv": true, "sidebar.dashboard": true, "sidebar.inventory": true, "brands.deleteBrand": true, "orders.cancelOrder": true, "orders.posCheckout": true, "people.viewProfile": true, "header.lowStockBell": true, "inventory.hubBrands": true, "orders.editDraftPos": true, "orders.posSaveDraft": true, "orders.printInvoice": true, "people.deletePerson": true, "products.addProduct": true, "admin.migrationGuide": true, "dashboard.reportsTab": true, "dashboard.statsCards": true, "people.recordPayment": true, "products.editProduct": true, "products.stockAdjust": true, "dashboard.overviewTab": true, "inventory.hubProducts": true, "purchaseOrders.cancel": true, "purchaseOrders.create": true, "register.viewActivity": true, "sidebar.documentation": true, "categories.addCategory": true, "inventory.hubMovements": true, "inventory.hubTransfers": true, "products.deleteProduct": true, "purchaseOrders.hubList": true, "categories.editCategory": true, "dashboard.lowStockPanel": true, "inventory.hubCategories": true, "inventory.hubWarehouses": true, "inventoryTransfers.list": true, "payments.editLedgerNote": true, "payments.fullLedgerView": true, "purchaseOrders.editNote": true, "purchaseOrders.exportCsv": true, "purchaseOrders.importCsv": true, "categories.deleteCategory": true, "dashboard.recentMovements": true, "inventoryTransfers.create": true, "dashboard.financialSnapshot": true, "inventory.hubPurchaseOrders": true, "purchaseOrders.confirmReceive": true, "payments.reverseLedgerOperation": true, "purchaseOrders.costOverridePriceDialog": true}', '2026-04-10 02:52:35.230587+00'),
	('954deeec-da6d-4096-8cdc-0dc950aa8a15', 'testing1', false, '{"orders.hubNew": true, "payments.list": true, "sidebar.admin": false, "orders.hubList": true, "brands.addBrand": true, "orders.editNote": true, "sidebar.control": false, "brands.editBrand": true, "orders.exportCsv": true, "orders.importCsv": true, "people.addPerson": true, "register.deposit": true, "orders.addPayment": true, "people.editPerson": true, "register.withdraw": true, "reports.exportCsv": true, "brands.deleteBrand": true, "orders.cancelOrder": true, "orders.posCheckout": true, "people.viewProfile": true, "orders.editDraftPos": true, "orders.printInvoice": true, "people.deletePerson": true, "products.addProduct": true, "people.recordPayment": true, "products.editProduct": true, "products.stockAdjust": true, "purchaseOrders.cancel": true, "purchaseOrders.create": true, "register.viewActivity": true, "categories.addCategory": true, "inventory.hubMovements": true, "products.deleteProduct": true, "purchaseOrders.hubList": true, "categories.editCategory": true, "inventoryTransfers.list": true, "payments.editLedgerNote": true, "payments.fullLedgerView": true, "purchaseOrders.editNote": true, "purchaseOrders.exportCsv": true, "purchaseOrders.importCsv": true, "categories.deleteCategory": true, "inventoryTransfers.create": true, "purchaseOrders.confirmReceive": true, "payments.reverseLedgerOperation": true, "purchaseOrders.costOverridePriceDialog": true}', '2026-04-10 03:25:00.75915+00');


--
-- Data for Name: purchase_orders; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."purchase_orders" ("id", "order_number", "supplier_name", "note", "total_amount", "status", "created_at", "updated_at", "person_id", "paid_amount", "remaining_amount", "warehouse_id", "subtotal", "discount_amount", "discount_rate", "is_historical_snapshot") VALUES
	('de0fba03-ed8b-41f0-b5ad-b0a53bb0fe89', 1, NULL, NULL, 406036.00, 'received', '2026-03-07 18:14:51.121671+00', '2026-03-07 18:14:51.121671+00', NULL, 0.00, 406036.00, 1, 406036.00, 0.00, 0.00, false),
	('b452f49a-af7e-45da-9351-1993262e40b9', 2, 'L1', NULL, 334.00, 'received', '2026-03-14 14:42:15.994523+00', '2026-03-14 14:42:15.994523+00', NULL, 0.00, 334.00, 1, 334.00, 0.00, 0.00, false),
	('fd4b6b41-002f-4083-ab20-dbde8b687e16', 3, 'l3', NULL, 1320.00, 'received', '2026-03-14 14:48:02.954494+00', '2026-03-14 14:48:02.954494+00', NULL, 1320.00, 0.00, 1, 1320.00, 0.00, 0.00, false),
	('684279d6-5d4f-4472-a578-9343ed0a5365', 4, 'Ahmed Hossam', NULL, 668.00, 'received', '2026-03-28 22:58:26.468185+00', '2026-03-28 22:58:26.468185+00', '838f5c75-7728-4383-9ce5-da876bb5386b', 0.00, 668.00, 1, 668.00, 0.00, 0.00, false),
	('b0e8b94f-ff38-41bf-9b24-a8941d288f3f', 5, 'Ahmed Hossam', NULL, 100.00, 'received', '2026-03-29 00:13:12.685966+00', '2026-03-29 00:13:12.685966+00', '838f5c75-7728-4383-9ce5-da876bb5386b', 0.00, 100.00, 1, 100.00, 0.00, 0.00, false),
	('7b436be1-8446-4c14-bdd4-512532c19000', 6, 'Ahmed Hossam', NULL, 336.01, 'received', '2026-03-30 01:33:55.936846+00', '2026-03-30 01:33:55.936846+00', '838f5c75-7728-4383-9ce5-da876bb5386b', 0.00, 336.01, 1, 336.01, 0.00, 0.00, false),
	('1e9666fe-5072-42b1-b43f-5cd11b06399b', 7, 'Ahmed Hossam', NULL, 5344.00, 'received', '2026-03-30 01:45:33.028642+00', '2026-03-30 01:45:33.028642+00', '838f5c75-7728-4383-9ce5-da876bb5386b', 5344.00, 0.00, 1, 5344.00, 0.00, 0.00, false),
	('5623a82f-ff89-4b30-9913-230e653e9c50', 8, 'Supplier', NULL, 90.00, 'received', '2026-03-31 21:46:06.754793+00', '2026-03-31 21:46:06.754793+00', '355ddf91-4d5a-4c80-bd3a-3c1e6cdfbb2c', 2.00, 88.00, 1, 90.00, 0.00, 0.00, false),
	('234d7f03-a17c-4496-8d65-a2795ed3cc1a', 9, 'Supplier', NULL, 90.00, 'received', '2026-03-31 21:49:42.539796+00', '2026-03-31 21:49:42.539796+00', '355ddf91-4d5a-4c80-bd3a-3c1e6cdfbb2c', 0.00, 90.00, 1, 90.00, 0.00, 0.00, false),
	('858dac90-2a6a-41a4-9b28-125203cb5e99', 10, 'Supplier', NULL, 90.00, 'received', '2026-03-31 22:06:33.328051+00', '2026-03-31 22:06:33.328051+00', '355ddf91-4d5a-4c80-bd3a-3c1e6cdfbb2c', 0.00, 90.00, 1, 90.00, 0.00, 0.00, false),
	('2248f779-234e-4414-a6fe-a12d81041429', 11, 'Supplier', NULL, 334.00, 'received', '2026-03-31 22:31:00.314536+00', '2026-03-31 22:31:00.314536+00', '355ddf91-4d5a-4c80-bd3a-3c1e6cdfbb2c', 334.00, 0.00, 1, 334.00, 0.00, 0.00, false),
	('1002d488-dc7e-4cd9-8ece-5b8e089ae814', 12, NULL, NULL, 334.00, 'received', '2026-03-31 22:43:14.524812+00', '2026-03-31 22:43:14.524812+00', NULL, 334.00, 0.00, 1, 334.00, 0.00, 0.00, false),
	('1dfbcdf0-7090-4d04-a001-9736e61e9862', 13, 'Supplier', NULL, 334.00, 'received', '2026-03-31 22:45:26.121134+00', '2026-03-31 22:45:26.121134+00', '355ddf91-4d5a-4c80-bd3a-3c1e6cdfbb2c', 200.00, 134.00, 1, 334.00, 0.00, 0.00, false),
	('82420264-c749-4d90-83f3-6c9ca3cd659a', 14, 'Supplier', NULL, 334.00, 'received', '2026-03-31 23:08:47.066969+00', '2026-03-31 23:08:47.066969+00', '355ddf91-4d5a-4c80-bd3a-3c1e6cdfbb2c', 64.00, 270.00, 1, 334.00, 0.00, 0.00, false),
	('9d330912-f708-41cf-b9db-4dddf9ea40ea', 15, 'Supplier', NULL, 334.00, 'received', '2026-03-31 23:39:41.727306+00', '2026-03-31 23:39:41.727306+00', '355ddf91-4d5a-4c80-bd3a-3c1e6cdfbb2c', 0.00, 0.00, 1, 334.00, 0.00, 0.00, false),
	('4d10da78-b34d-4b28-8755-3365103f1f51', 16, 'Supplier', NULL, 33400.00, 'cancelled', '2026-04-02 00:28:05.708717+00', '2026-04-02 00:28:38.609+00', '355ddf91-4d5a-4c80-bd3a-3c1e6cdfbb2c', 0.00, 0.00, 1, 33400.00, 0.00, 0.00, false),
	('7384a9fd-22de-437b-92ed-355fce028dcf', 17, 'Supplier', NULL, 334.00, 'cancelled', '2026-04-02 00:46:46.91702+00', '2026-04-02 00:47:52.308+00', '355ddf91-4d5a-4c80-bd3a-3c1e6cdfbb2c', 0.00, 0.00, 1, 334.00, 0.00, 0.00, false),
	('716e3a54-c389-426d-af82-2174ab3f5e7d', 18, 'Supplier', NULL, 334.00, 'cancelled', '2026-04-02 00:53:16.966918+00', '2026-04-02 00:53:58.426+00', '355ddf91-4d5a-4c80-bd3a-3c1e6cdfbb2c', 0.00, 0.00, 1, 334.00, 0.00, 0.00, false),
	('34045aed-4613-426d-b4b1-42dc39dcdad2', 19, 'Supplier', NULL, 1000.00, 'cancelled', '2026-04-02 01:04:06.109825+00', '2026-04-02 01:04:53.74+00', '355ddf91-4d5a-4c80-bd3a-3c1e6cdfbb2c', 0.00, 0.00, 1, 1000.00, 0.00, 0.00, false),
	('38695d77-2676-4f42-b085-5552a7b4e91b', 20, 'Supplier', NULL, 23380.00, 'cancelled', '2026-04-02 01:26:02.658334+00', '2026-04-02 01:26:32.965+00', '355ddf91-4d5a-4c80-bd3a-3c1e6cdfbb2c', 0.00, 0.00, 1, 23380.00, 0.00, 0.00, false),
	('0950e2fa-2f1a-43c5-8cd2-27d2b17d9130', 21, 'Ahmed Hossam', NULL, 334.00, 'cancelled', '2026-04-02 01:55:08.470277+00', '2026-04-02 01:55:17.791+00', '838f5c75-7728-4383-9ce5-da876bb5386b', 0.00, 0.00, 1, 334.00, 0.00, 0.00, false),
	('02fc9c1f-284f-4d0c-ae6e-d16a4cbd8147', 22, 'Supplier', NULL, 334.00, 'received', '2026-04-02 03:09:57.184885+00', '2026-04-02 03:09:57.184885+00', '355ddf91-4d5a-4c80-bd3a-3c1e6cdfbb2c', 0.00, 0.00, 1, 334.00, 0.00, 0.00, false),
	('e4d256fe-13f7-4b70-99dd-3be672d55c61', 23, 'Supplier', NULL, 334.00, 'cancelled', '2026-04-02 10:11:35.723277+00', '2026-04-02 10:12:07.563+00', '355ddf91-4d5a-4c80-bd3a-3c1e6cdfbb2c', 0.00, 0.00, 1, 334.00, 0.00, 0.00, false),
	('af494e57-ebe9-4941-a45b-b14a02aa53af', 24, 'Supplier', NULL, 334.00, 'cancelled', '2026-04-02 10:27:24.12308+00', '2026-04-02 10:27:43.278+00', '355ddf91-4d5a-4c80-bd3a-3c1e6cdfbb2c', 0.00, 0.00, 1, 334.00, 0.00, 0.00, false),
	('2c133408-64ad-4fc1-a02c-5d4993b3aefb', 25, 'Ahmed Hossam', NULL, 334.00, 'cancelled', '2026-04-02 19:24:01.795469+00', '2026-04-02 19:24:21.929+00', '838f5c75-7728-4383-9ce5-da876bb5386b', 0.00, 0.00, 1, 334.00, 0.00, 0.00, false),
	('9d4fd136-20a3-4491-aafb-eb9c73951681', 26, 'Supplier', NULL, 334.00, 'cancelled', '2026-04-03 17:17:41.554424+00', '2026-04-03 17:17:59.866+00', '355ddf91-4d5a-4c80-bd3a-3c1e6cdfbb2c', 0.00, 0.00, 1, 334.00, 0.00, 0.00, false),
	('f0685503-af68-41ce-8592-64f93c011521', 27, 'Supplier', NULL, 41284.00, 'received', '2026-04-03 17:47:47.451454+00', '2026-04-03 17:48:00.595+00', '355ddf91-4d5a-4c80-bd3a-3c1e6cdfbb2c', 0.00, 0.00, 1, 41284.00, 0.00, 0.00, false),
	('1d7ec987-038d-4cb5-89e3-5059dcf7410a', 28, 'Supplier', 'follow up with PO-24 · doc:af494e57-ebe9-4941-a45b-b14a02aa53af where it may works @[pay:6907620f-d613-4325-889b-496aa923367b]', 334.00, 'received', '2026-04-03 20:19:53.619635+00', '2026-04-03 20:37:42.796+00', '355ddf91-4d5a-4c80-bd3a-3c1e6cdfbb2c', 0.00, 0.00, 1, 334.00, 0.00, 0.00, false),
	('bd1df1b4-17c5-450b-8ddf-2bd8c771adcc', 29, 'Ahmed Hossam', NULL, 690.00, 'received', '2026-04-04 16:04:13.54019+00', '2026-04-04 16:04:13.54019+00', '838f5c75-7728-4383-9ce5-da876bb5386b', 0.00, 0.00, 1, 690.00, 0.00, 0.00, false),
	('b92c96c3-f7a1-47f1-902c-ba45894e14a6', 30, 'Ahmed Hossam', NULL, 384.00, 'received', '2026-04-04 16:05:47.160753+00', '2026-04-04 16:05:47.160753+00', '838f5c75-7728-4383-9ce5-da876bb5386b', 0.00, 0.00, 1, 384.00, 0.00, 0.00, false),
	('df606274-1c6f-433e-b845-1c9d375ac812', 31, 'Ahmed Hossam', NULL, 330.00, 'received', '2026-04-04 23:13:58.353644+00', '2026-04-04 23:13:58.353644+00', '838f5c75-7728-4383-9ce5-da876bb5386b', 0.00, 0.00, 1, 330.00, 0.00, 0.00, false),
	('7e3aa601-7989-4685-8cd5-79cd59c0fd68', 32, 'Ahmed Hossam', NULL, 70.00, 'received', '2026-04-04 23:15:36.351628+00', '2026-04-04 23:15:36.351628+00', '838f5c75-7728-4383-9ce5-da876bb5386b', 0.00, 0.00, 1, 70.00, 0.00, 0.00, false),
	('6c61c713-616d-4f8c-a776-7be1273a1b4b', 33, 'Supplier', NULL, 1057.00, 'received', '2026-04-04 23:24:01.366986+00', '2026-04-04 23:24:01.366986+00', '355ddf91-4d5a-4c80-bd3a-3c1e6cdfbb2c', 0.00, 0.00, 1, 1057.00, 0.00, 0.00, false),
	('bbda493e-f94e-4969-99c1-dd5775d32ccd', 34, 'Ahmed Hossam', NULL, 1050.00, 'received', '2026-04-07 22:51:16.987674+00', '2026-04-07 22:51:16.987674+00', '838f5c75-7728-4383-9ce5-da876bb5386b', 0.00, 0.00, 2, 1050.00, 0.00, 0.00, false),
	('1f295127-ef94-4387-968b-46618631c31c', 35, 'Ahmed Hossam', NULL, 35.00, 'received', '2026-04-08 03:24:39.729025+00', '2026-04-08 03:24:39.729025+00', '838f5c75-7728-4383-9ce5-da876bb5386b', 0.00, 0.00, 2, 35.00, 0.00, 0.00, false);


--
-- Data for Name: purchase_order_items; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."purchase_order_items" ("id", "purchase_order_id", "product_id", "quantity", "cost_price", "total_price", "previous_cost_price", "cost_price_updated", "created_at", "catalog_customer_price", "catalog_business_price", "previous_customer_price", "previous_business_price", "line_discount_rate") VALUES
	('a7ee2129-acf8-4d88-b349-fe73132f6691', 'de0fba03-ed8b-41f0-b5ad-b0a53bb0fe89', 'c7fc94f5-471c-48c4-8385-126efafa3e3f', 1223, 332.00, 406036.00, 530.00, true, '2026-03-07 18:14:51.318849+00', NULL, NULL, NULL, NULL, 0.00),
	('b3cca7ba-fdb9-4317-ad42-c7f1229997f9', 'b452f49a-af7e-45da-9351-1993262e40b9', 'c7fc94f5-471c-48c4-8385-126efafa3e3f', 1, 334.00, 334.00, 332.00, true, '2026-03-14 14:42:16.221935+00', NULL, NULL, NULL, NULL, 0.00),
	('0f424135-5800-40dd-afbc-d6b0c151aa3b', 'fd4b6b41-002f-4083-ab20-dbde8b687e16', '38e5be56-bbc6-45af-ae50-f9569bfe6ca3', 4, 330.00, 1320.00, 330.00, false, '2026-03-14 14:48:03.253116+00', NULL, NULL, NULL, NULL, 0.00),
	('d0718474-8f20-4ab8-9c9a-af9036f2a7e2', '684279d6-5d4f-4472-a578-9343ed0a5365', 'c7fc94f5-471c-48c4-8385-126efafa3e3f', 2, 334.00, 668.00, 334.00, false, '2026-03-28 22:58:26.664355+00', NULL, NULL, NULL, NULL, 0.00),
	('b3c27a75-46e7-45df-963d-e780f798623d', 'b0e8b94f-ff38-41bf-9b24-a8941d288f3f', '4df4d69c-9c2f-4221-8816-5eae1947bd96', 50, 2.00, 100.00, 2.00, false, '2026-03-29 00:13:12.875975+00', NULL, NULL, NULL, NULL, 0.00),
	('e3124d7c-08bd-4a63-9bc5-743c47ade231', '7b436be1-8446-4c14-bdd4-512532c19000', 'c7fc94f5-471c-48c4-8385-126efafa3e3f', 1, 334.01, 334.01, 334.00, false, '2026-03-30 01:33:56.219559+00', NULL, NULL, NULL, NULL, 0.00),
	('d7574825-ed29-4a4a-9742-8f2c6cc6a3f8', '7b436be1-8446-4c14-bdd4-512532c19000', '4df4d69c-9c2f-4221-8816-5eae1947bd96', 1, 2.00, 2.00, 2.00, false, '2026-03-30 01:33:56.219559+00', NULL, NULL, NULL, NULL, 0.00),
	('483fff50-8390-4f44-8628-a219e35dcc89', '1e9666fe-5072-42b1-b43f-5cd11b06399b', 'c7fc94f5-471c-48c4-8385-126efafa3e3f', 16, 334.00, 5344.00, 334.00, false, '2026-03-30 01:45:33.398435+00', NULL, NULL, NULL, NULL, 0.00),
	('47b8a89b-f2e9-4e3e-8c97-681626047e7a', '5623a82f-ff89-4b30-9913-230e653e9c50', '0427ab34-b940-49de-9de3-e2127a25070c', 1, 90.00, 90.00, 90.00, false, '2026-03-31 21:46:07.241042+00', NULL, NULL, NULL, NULL, 0.00),
	('4166a251-11a4-4d20-b92b-c1b54635d0dc', '234d7f03-a17c-4496-8d65-a2795ed3cc1a', '0427ab34-b940-49de-9de3-e2127a25070c', 1, 90.00, 90.00, 90.00, false, '2026-03-31 21:49:42.657989+00', NULL, NULL, NULL, NULL, 0.00),
	('5e9887ed-cc4d-45f5-8f9d-28ccf2c4bb65', '858dac90-2a6a-41a4-9b28-125203cb5e99', '0427ab34-b940-49de-9de3-e2127a25070c', 1, 90.00, 90.00, 90.00, false, '2026-03-31 22:06:33.722721+00', NULL, NULL, NULL, NULL, 0.00),
	('2d1a367a-0b23-492e-8dd2-40be3332ce70', '2248f779-234e-4414-a6fe-a12d81041429', 'c7fc94f5-471c-48c4-8385-126efafa3e3f', 1, 334.00, 334.00, 334.00, false, '2026-03-31 22:31:00.841394+00', NULL, NULL, NULL, NULL, 0.00),
	('4049808b-9e1a-4568-bff1-9dfb8d48d79b', '1002d488-dc7e-4cd9-8ece-5b8e089ae814', 'c7fc94f5-471c-48c4-8385-126efafa3e3f', 1, 334.00, 334.00, 334.00, false, '2026-03-31 22:43:14.814643+00', NULL, NULL, NULL, NULL, 0.00),
	('f5c3f9d6-e0ed-4880-a942-c02ce8f7b36c', '1dfbcdf0-7090-4d04-a001-9736e61e9862', 'c7fc94f5-471c-48c4-8385-126efafa3e3f', 1, 334.00, 334.00, 334.00, false, '2026-03-31 22:45:26.604605+00', NULL, NULL, NULL, NULL, 0.00),
	('7b24026f-c43e-44bd-9328-17554114faf3', '82420264-c749-4d90-83f3-6c9ca3cd659a', 'c7fc94f5-471c-48c4-8385-126efafa3e3f', 1, 334.00, 334.00, 334.00, false, '2026-03-31 23:08:47.552394+00', NULL, NULL, NULL, NULL, 0.00),
	('5250a00a-fa4c-4f45-b245-59c103bfb207', '9d330912-f708-41cf-b9db-4dddf9ea40ea', 'c7fc94f5-471c-48c4-8385-126efafa3e3f', 1, 334.00, 334.00, 334.00, false, '2026-03-31 23:39:41.989993+00', NULL, NULL, NULL, NULL, 0.00),
	('2674163f-e7d0-4cad-bfa4-a0b5af6b86d0', '4d10da78-b34d-4b28-8755-3365103f1f51', 'c7fc94f5-471c-48c4-8385-126efafa3e3f', 100, 334.00, 33400.00, 334.00, false, '2026-04-02 00:28:06.163395+00', NULL, NULL, NULL, NULL, 0.00),
	('123cbd88-5dd5-451e-8e46-70c8db53f42b', '7384a9fd-22de-437b-92ed-355fce028dcf', 'c7fc94f5-471c-48c4-8385-126efafa3e3f', 1, 334.00, 334.00, 334.00, false, '2026-04-02 00:46:47.543822+00', NULL, NULL, NULL, NULL, 0.00),
	('4b90c3fa-fb45-4058-8ad4-115ebacdfdc9', '716e3a54-c389-426d-af82-2174ab3f5e7d', 'c7fc94f5-471c-48c4-8385-126efafa3e3f', 1, 334.00, 334.00, 334.00, false, '2026-04-02 00:53:17.207761+00', NULL, NULL, NULL, NULL, 0.00),
	('4788ecd8-9825-4064-b9f3-647148924d08', '34045aed-4613-426d-b4b1-42dc39dcdad2', 'c7fc94f5-471c-48c4-8385-126efafa3e3f', 1, 1000.00, 1000.00, 334.00, false, '2026-04-02 01:04:06.470062+00', NULL, NULL, NULL, NULL, 0.00),
	('3add7935-1484-4e7b-a5f7-4e193b8e7186', '38695d77-2676-4f42-b085-5552a7b4e91b', 'c7fc94f5-471c-48c4-8385-126efafa3e3f', 70, 334.00, 23380.00, 334.00, false, '2026-04-02 01:26:02.96645+00', NULL, NULL, NULL, NULL, 0.00),
	('532dc6bb-4db7-49fa-8b9f-affad13b86a2', '0950e2fa-2f1a-43c5-8cd2-27d2b17d9130', 'c7fc94f5-471c-48c4-8385-126efafa3e3f', 1, 334.00, 334.00, 334.00, false, '2026-04-02 01:55:08.981525+00', NULL, NULL, NULL, NULL, 0.00),
	('5a49f6a5-4e92-4cf1-9bc8-b12dd0688ca7', '02fc9c1f-284f-4d0c-ae6e-d16a4cbd8147', 'c7fc94f5-471c-48c4-8385-126efafa3e3f', 1, 334.00, 334.00, 334.00, false, '2026-04-02 03:09:57.606806+00', NULL, NULL, NULL, NULL, 0.00),
	('aa5d54eb-c837-4b64-9695-9c08add2d437', 'e4d256fe-13f7-4b70-99dd-3be672d55c61', 'c7fc94f5-471c-48c4-8385-126efafa3e3f', 1, 334.00, 334.00, 334.00, false, '2026-04-02 10:11:36.086387+00', NULL, NULL, NULL, NULL, 0.00),
	('e93ba82e-47e1-4db8-84ab-adf8cd148eff', 'af494e57-ebe9-4941-a45b-b14a02aa53af', 'c7fc94f5-471c-48c4-8385-126efafa3e3f', 1, 334.00, 334.00, 334.00, false, '2026-04-02 10:27:24.451693+00', NULL, NULL, NULL, NULL, 0.00),
	('5504a1ae-4f1a-4ba8-af17-9ff4c41c3db9', '2c133408-64ad-4fc1-a02c-5d4993b3aefb', 'c7fc94f5-471c-48c4-8385-126efafa3e3f', 1, 334.00, 334.00, 334.00, false, '2026-04-02 19:24:02.231812+00', NULL, NULL, NULL, NULL, 0.00),
	('99912397-847e-45ef-8355-1627eac3e4f2', '9d4fd136-20a3-4491-aafb-eb9c73951681', 'c7fc94f5-471c-48c4-8385-126efafa3e3f', 1, 334.00, 334.00, 334.00, false, '2026-04-03 17:17:42.003065+00', NULL, NULL, NULL, NULL, 0.00),
	('43fe3077-db8b-43cf-be1a-ccaec6d5060e', 'f0685503-af68-41ce-8592-64f93c011521', 'c7fc94f5-471c-48c4-8385-126efafa3e3f', 1, 334.00, 334.00, 334.00, false, '2026-04-03 17:47:47.587703+00', NULL, NULL, NULL, NULL, 0.00),
	('6cc1ceff-8748-4477-b2fc-a747fae549e6', 'f0685503-af68-41ce-8592-64f93c011521', '0427ab34-b940-49de-9de3-e2127a25070c', 455, 90.00, 40950.00, 90.00, false, '2026-04-03 17:47:47.587703+00', NULL, NULL, NULL, NULL, 0.00),
	('916d8d64-f4c7-44ed-a3fd-f060e6eb3842', '1d7ec987-038d-4cb5-89e3-5059dcf7410a', 'c7fc94f5-471c-48c4-8385-126efafa3e3f', 1, 334.00, 334.00, 334.00, false, '2026-04-03 20:19:54.057918+00', NULL, NULL, NULL, NULL, 0.00),
	('5abf7698-0834-4122-a404-6b7b57806b33', 'bd1df1b4-17c5-450b-8ddf-2bd8c771adcc', 'c7fc94f5-471c-48c4-8385-126efafa3e3f', 1, 330.00, 330.00, 334.00, false, '2026-04-04 16:04:13.838308+00', NULL, NULL, 544.00, 540.00, 0.00),
	('9a980ac7-fbeb-4413-bdc5-c8d5bb79b060', 'bd1df1b4-17c5-450b-8ddf-2bd8c771adcc', '0427ab34-b940-49de-9de3-e2127a25070c', 4, 90.00, 360.00, 90.00, false, '2026-04-04 16:04:13.838308+00', NULL, NULL, 120.00, 100.00, 0.00),
	('62acea45-0262-4057-a216-84e9084a9457', 'b92c96c3-f7a1-47f1-902c-ba45894e14a6', 'c7fc94f5-471c-48c4-8385-126efafa3e3f', 1, 339.00, 339.00, 334.00, true, '2026-04-04 16:05:47.29805+00', 544.00, 540.00, 544.00, 540.00, 0.00),
	('8213f92b-c757-4c1a-96d2-1bc5c367868c', 'b92c96c3-f7a1-47f1-902c-ba45894e14a6', '0427ab34-b940-49de-9de3-e2127a25070c', 1, 45.00, 45.00, 90.00, true, '2026-04-04 16:05:47.29805+00', 120.00, 100.00, 120.00, 100.00, 0.00),
	('0f1ec7be-463d-4071-9ebb-b7089e367ea4', 'df606274-1c6f-433e-b845-1c9d375ac812', 'c7fc94f5-471c-48c4-8385-126efafa3e3f', 1, 330.00, 330.00, 339.00, true, '2026-04-04 23:13:58.557712+00', 544.00, 540.00, 544.00, 540.00, 0.00),
	('d31b8148-8d9b-49e9-8cc8-824024f41498', '7e3aa601-7989-4685-8cd5-79cd59c0fd68', 'c7fc94f5-471c-48c4-8385-126efafa3e3f', 1, 70.00, 70.00, 330.00, true, '2026-04-04 23:15:36.522412+00', 544.00, 540.00, 544.00, 540.00, 0.00),
	('63f0b727-c40d-45ce-91a3-478b5c5737d7', '6c61c713-616d-4f8c-a776-7be1273a1b4b', 'c7fc94f5-471c-48c4-8385-126efafa3e3f', 1, 35.00, 35.00, 70.00, true, '2026-04-04 23:24:01.587944+00', 544.00, 540.00, 544.00, 540.00, 0.00),
	('80473324-8c28-4626-824a-a26da28b877a', '6c61c713-616d-4f8c-a776-7be1273a1b4b', '0427ab34-b940-49de-9de3-e2127a25070c', 15, 45.00, 675.00, 45.00, false, '2026-04-04 23:24:01.587944+00', NULL, NULL, 120.00, 100.00, 0.00),
	('119e4eb3-a079-495d-b318-f06726275dff', '6c61c713-616d-4f8c-a776-7be1273a1b4b', '38e5be56-bbc6-45af-ae50-f9569bfe6ca3', 1, 347.00, 347.00, 340.00, false, '2026-04-04 23:24:01.587944+00', NULL, NULL, 355.00, 350.00, 0.00),
	('fcd4d645-6389-488b-9204-cdb289ebe37d', 'bbda493e-f94e-4969-99c1-dd5775d32ccd', 'c7fc94f5-471c-48c4-8385-126efafa3e3f', 30, 35.00, 1050.00, 35.00, false, '2026-04-07 22:51:17.171067+00', NULL, NULL, 544.00, 540.00, 0.00),
	('6997dcc2-ea68-417e-bd58-6dbfcc7bff4d', '1f295127-ef94-4387-968b-46618631c31c', 'c7fc94f5-471c-48c4-8385-126efafa3e3f', 1, 35.00, 35.00, 35.00, false, '2026-04-08 03:24:40.248021+00', NULL, NULL, 544.00, 540.00, 0.00);


--
-- Data for Name: purchase_order_payments; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."purchase_order_payments" ("id", "purchase_order_id", "payment_method", "amount", "created_at") VALUES
	('8da6d37c-820c-4fe1-9f2b-4bae6884d1cc', 'fd4b6b41-002f-4083-ab20-dbde8b687e16', 'cash', 13.00, '2026-03-14 14:48:03.142134+00'),
	('ed001663-24a4-4de9-b525-5bd1487bbef6', '5623a82f-ff89-4b30-9913-230e653e9c50', 'cash', 2.00, '2026-03-31 21:46:07.020655+00'),
	('ce7c8851-9e7f-4cba-9775-30c2d8bc1ae9', '2248f779-234e-4414-a6fe-a12d81041429', 'cash', 334.00, '2026-03-31 22:31:00.50446+00'),
	('96774ad8-28be-4480-9a4b-86fffa1affd2', '1002d488-dc7e-4cd9-8ece-5b8e089ae814', 'cash', 334.00, '2026-03-31 22:43:14.697208+00'),
	('56a10521-0360-4927-8f5a-a80523c01943', '1dfbcdf0-7090-4d04-a001-9736e61e9862', 'cash', 100.00, '2026-03-31 22:45:26.43145+00'),
	('a2f8a9cc-5981-46d6-9c97-2ea445933aaa', '82420264-c749-4d90-83f3-6c9ca3cd659a', 'cash', 32.00, '2026-03-31 23:08:47.372523+00'),
	('83c7b884-9a7c-4a7c-af4d-bdba3e12bf1a', 'fd4b6b41-002f-4083-ab20-dbde8b687e16', 'visa', 1307.00, '2026-03-14 14:48:03.142134+00'),
	('d4f75031-4d18-45aa-84b8-6a1c93403184', '1e9666fe-5072-42b1-b43f-5cd11b06399b', 'visa', 5344.00, '2026-03-30 01:45:33.25764+00'),
	('d49cdc1a-aec3-4b77-add7-14c6adc7934c', '1dfbcdf0-7090-4d04-a001-9736e61e9862', 'visa', 100.00, '2026-03-31 22:45:26.43145+00'),
	('0e8345f4-1600-4a46-a52e-e1a2ddfecdd8', '82420264-c749-4d90-83f3-6c9ca3cd659a', 'visa', 32.00, '2026-03-31 23:08:47.372523+00'),
	('f0580b7b-c333-44ba-953a-f504c3775060', '9d330912-f708-41cf-b9db-4dddf9ea40ea', 'cash', 5.00, '2026-03-31 23:39:41.859673+00'),
	('11eb41ed-d92f-40db-bac0-08d0f649f289', '9d330912-f708-41cf-b9db-4dddf9ea40ea', 'visa', 5.00, '2026-03-31 23:39:41.859673+00'),
	('0081e30f-8f6e-4e02-869d-f9483a88b8a3', '9d330912-f708-41cf-b9db-4dddf9ea40ea', 'cheque', 5.00, '2026-03-31 23:39:41.859673+00'),
	('1892a0e0-7e33-432f-bfcb-56a8ea0e600e', '9d330912-f708-41cf-b9db-4dddf9ea40ea', 'instapay', 5.00, '2026-03-31 23:39:41.859673+00'),
	('e9900f02-f574-4b8a-b332-1296f6a4154f', '4d10da78-b34d-4b28-8755-3365103f1f51', 'cash', 10000.00, '2026-04-02 00:28:05.947005+00'),
	('624d2f30-c3ea-4bee-a9be-8093c1187e00', '02fc9c1f-284f-4d0c-ae6e-d16a4cbd8147', 'cash', 100.00, '2026-04-02 03:09:57.381668+00'),
	('50c903e7-38b5-44c0-95b8-e5be7179161d', '1d7ec987-038d-4cb5-89e3-5059dcf7410a', 'cash', 56.00, '2026-04-03 20:19:53.857521+00'),
	('41349356-421e-4669-808b-21e612a3f40b', '1f295127-ef94-4387-968b-46618631c31c', 'cheque', 35.00, '2026-04-08 03:24:39.941512+00');


--
-- Data for Name: stock_movements; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."stock_movements" ("id", "product_id", "type", "quantity", "note", "created_at", "warehouse_id") VALUES
	('1fdf6b07-f978-4d7b-b3b3-54dcea354a50', 'c7fc94f5-471c-48c4-8385-126efafa3e3f', 'in', 30, 'Purchase Order #34', '2026-04-07 22:51:17.78321+00', 2),
	('377e016a-37ec-4dd0-97df-1dedf5a65ff1', 'c7fc94f5-471c-48c4-8385-126efafa3e3f', 'out', 1, 'Order #57', '2026-04-08 02:30:51.959319+00', 1),
	('4f9973b8-58c8-4a1d-957a-b5072a09be58', 'c7fc94f5-471c-48c4-8385-126efafa3e3f', 'out', 10, 'Transfer #3 (out)', '2026-04-08 02:57:45.675945+00', 1),
	('8bf26d4e-2291-4208-8ff5-a3bcc842d7b1', 'c7fc94f5-471c-48c4-8385-126efafa3e3f', 'in', 10, 'Transfer #3 (in)', '2026-04-08 02:57:45.675945+00', 2),
	('ad40256d-2b62-414b-a051-bdf0a3b8da60', 'c7fc94f5-471c-48c4-8385-126efafa3e3f', 'in', 1, 'Purchase Order #35', '2026-04-08 03:24:40.815129+00', 2),
	('cb1de35c-2599-44b7-8708-aa8d936dff73', 'c7fc94f5-471c-48c4-8385-126efafa3e3f', 'out', 1, 'Order #56', '2026-04-07 22:51:48.195981+00', 2),
	('c62efdca-9076-44c3-b23b-f62fc328353b', 'c7fc94f5-471c-48c4-8385-126efafa3e3f', 'out', 30, 'Transfer #2 (out)', '2026-04-08 02:42:29.540577+00', 2),
	('ec81108b-87b4-40ed-ad9a-0e169a55fdeb', 'c7fc94f5-471c-48c4-8385-126efafa3e3f', 'in', 30, 'Transfer #2 (in)', '2026-04-08 02:42:29.540577+00', 1),
	('53fbebd4-a2ea-4d2f-904e-cfda0e80d601', 'c7fc94f5-471c-48c4-8385-126efafa3e3f', 'out', 1, 'Order #58', '2026-04-08 02:58:09.881958+00', 2),
	('fc8cf2e5-067d-4b3c-b199-b62de268b879', 'c7fc94f5-471c-48c4-8385-126efafa3e3f', 'out', 1, 'Order #59', '2026-04-09 23:40:51.606223+00', 1),
	('d55f8d99-ef95-453c-a94c-bcafdab52392', '38e5be56-bbc6-45af-ae50-f9569bfe6ca3', 'out', 7, NULL, '2026-03-07 15:17:21.137799+00', 1),
	('01877206-8914-453a-bd42-ca77f15917c6', 'c7fc94f5-471c-48c4-8385-126efafa3e3f', 'in', 1223, 'Purchase Order #1', '2026-03-07 18:14:51.665239+00', 1),
	('7da92417-ac60-4b0b-946c-11d4d280af14', '38e5be56-bbc6-45af-ae50-f9569bfe6ca3', 'out', 1, NULL, '2026-03-14 14:40:59.501997+00', 1),
	('5ac61524-6048-4124-b057-b09dded8aa85', 'c7fc94f5-471c-48c4-8385-126efafa3e3f', 'in', 1, 'Purchase Order #2', '2026-03-14 14:42:16.564619+00', 1),
	('a58b3ed9-9738-4681-87d7-6dc114fcc93f', '38e5be56-bbc6-45af-ae50-f9569bfe6ca3', 'in', 4, 'Purchase Order #3', '2026-03-14 14:48:03.464731+00', 1),
	('903b8f7d-f1d2-460f-8748-a99e9518d25c', 'c7fc94f5-471c-48c4-8385-126efafa3e3f', 'in', 2, 'Purchase Order #4', '2026-03-28 22:58:27.13703+00', 1),
	('57c06856-80dd-4bbc-91e1-7783b31a5254', '38e5be56-bbc6-45af-ae50-f9569bfe6ca3', 'out', 1, NULL, '2026-03-28 22:59:10.671302+00', 1),
	('c2a72230-53ef-4f2d-ac5e-0f09584dc90d', 'c7fc94f5-471c-48c4-8385-126efafa3e3f', 'out', 5, NULL, '2026-03-28 23:00:49.153321+00', 1),
	('0f340cc2-619e-4d93-81ae-2aa7810a698c', 'c7fc94f5-471c-48c4-8385-126efafa3e3f', 'out', 2, 'Order #10', '2026-03-28 23:52:57.387066+00', 1),
	('48bf0bbc-45b1-440a-bd2a-0bf7082cf9ca', '4df4d69c-9c2f-4221-8816-5eae1947bd96', 'in', 50, 'Purchase Order #5', '2026-03-29 00:13:13.286283+00', 1),
	('1c60d761-d485-4593-9dfb-2577f4b75678', '4df4d69c-9c2f-4221-8816-5eae1947bd96', 'out', 15, 'Order #11', '2026-03-29 00:29:06.477021+00', 1),
	('6f67ecb3-2b69-4baf-9cbb-30dc4eb27db6', 'c7fc94f5-471c-48c4-8385-126efafa3e3f', 'out', 1, 'Order #13', '2026-03-29 00:55:00.538873+00', 1),
	('498c1d7f-564b-4ef6-890a-db71e1a7b572', 'c7fc94f5-471c-48c4-8385-126efafa3e3f', 'out', 1, 'Order #15', '2026-03-29 01:09:32.095798+00', 1),
	('f5fa737d-eb9e-4bdb-a97d-35217c48f294', 'c7fc94f5-471c-48c4-8385-126efafa3e3f', 'in', 1, 'Purchase Order #6', '2026-03-30 01:33:56.576957+00', 1),
	('10d8ac07-7eaf-4ab4-8c7c-974f3d065589', '4df4d69c-9c2f-4221-8816-5eae1947bd96', 'in', 1, 'Purchase Order #6', '2026-03-30 01:33:57.16636+00', 1),
	('512ab916-8537-4d1f-b3ee-91a90ae7b3d3', 'c7fc94f5-471c-48c4-8385-126efafa3e3f', 'in', 16, 'Purchase Order #7', '2026-03-30 01:45:33.783621+00', 1),
	('e272db3b-4608-4d33-8481-0fa9aeeb2d80', '0427ab34-b940-49de-9de3-e2127a25070c', 'in', 1, 'Purchase Order #8', '2026-03-31 21:46:08.061571+00', 1),
	('845b6825-d749-4149-b6c4-a0c593acbf3a', '0427ab34-b940-49de-9de3-e2127a25070c', 'in', 1, 'Purchase Order #9', '2026-03-31 21:49:42.915646+00', 1),
	('5159c40c-2401-4e0a-8f20-13a2d197e413', '0427ab34-b940-49de-9de3-e2127a25070c', 'out', 1, 'Order #16', '2026-03-31 21:50:43.578369+00', 1),
	('afd6b2b6-ae26-42a5-a577-84432154d44c', '0427ab34-b940-49de-9de3-e2127a25070c', 'in', 1, 'Purchase Order #10', '2026-03-31 22:06:34.112749+00', 1),
	('22bb8c0c-9dc4-44f7-bcd8-db57dfba3b29', '0427ab34-b940-49de-9de3-e2127a25070c', 'out', 2, 'Order #19', '2026-03-31 22:14:50.697914+00', 1),
	('5bebe99a-8d3f-4902-acc7-b351e44f56b1', 'c7fc94f5-471c-48c4-8385-126efafa3e3f', 'out', 1, 'Order #20', '2026-03-31 22:29:54.266063+00', 1),
	('0eb8e563-c907-4d82-9639-7ea88ffd6e4d', 'c7fc94f5-471c-48c4-8385-126efafa3e3f', 'in', 1, 'Purchase Order #11', '2026-03-31 22:31:01.164029+00', 1),
	('fa453a84-c4b3-4b48-ac97-417735e8fd2d', 'c7fc94f5-471c-48c4-8385-126efafa3e3f', 'in', 1, 'Purchase Order #12', '2026-03-31 22:43:15.112726+00', 1),
	('143804d7-0259-4ba9-baff-98bd84fb49d6', 'c7fc94f5-471c-48c4-8385-126efafa3e3f', 'out', 1, 'Order #21', '2026-03-31 22:44:08.159613+00', 1),
	('9c253d69-1ea0-46ae-a960-892bcc739ad4', 'c7fc94f5-471c-48c4-8385-126efafa3e3f', 'in', 1, 'Purchase Order #13', '2026-03-31 22:45:26.889107+00', 1),
	('40163a12-0aa8-4126-bff6-e939bb78bd2b', 'c7fc94f5-471c-48c4-8385-126efafa3e3f', 'out', 1, 'Order #22', '2026-03-31 22:47:39.89813+00', 1),
	('1f1212ea-4564-4bad-bf7b-41c9888b892f', 'c7fc94f5-471c-48c4-8385-126efafa3e3f', 'out', 1, 'Order #23', '2026-03-31 23:06:29.168176+00', 1),
	('0aed8498-e358-4f73-93d2-41bd1458a537', 'c7fc94f5-471c-48c4-8385-126efafa3e3f', 'out', 1, 'Order #24', '2026-03-31 23:06:55.857353+00', 1),
	('2ff7ec0a-1574-40cc-9dd3-4ec019cd9df5', 'c7fc94f5-471c-48c4-8385-126efafa3e3f', 'in', 1, 'Purchase Order #14', '2026-03-31 23:08:47.784899+00', 1),
	('66530dca-09f9-484b-b01c-5e3a2c2c5882', 'c7fc94f5-471c-48c4-8385-126efafa3e3f', 'out', 1, 'Order #25', '2026-03-31 23:23:23.527751+00', 1),
	('64b595a4-90d2-4822-a87e-0c52d7434b80', 'c7fc94f5-471c-48c4-8385-126efafa3e3f', 'out', 1, 'Order #26', '2026-03-31 23:23:54.663602+00', 1),
	('d42a7787-da43-4701-bb9c-77ef344de563', 'c7fc94f5-471c-48c4-8385-126efafa3e3f', 'out', 1, 'Order #27', '2026-03-31 23:38:49.020138+00', 1),
	('bd6a8bff-7332-4da1-a016-cb7a8ebedec6', 'c7fc94f5-471c-48c4-8385-126efafa3e3f', 'in', 1, 'Purchase Order #15', '2026-03-31 23:39:42.449023+00', 1),
	('00a2158b-0341-4160-8b7b-5bca17f20e8f', 'c7fc94f5-471c-48c4-8385-126efafa3e3f', 'out', 1, 'Order #28', '2026-04-01 00:03:15.292377+00', 1),
	('f9fc6a5a-c950-460f-9b1a-fd6cba5787b1', 'c7fc94f5-471c-48c4-8385-126efafa3e3f', 'out', 1, 'Order #29', '2026-04-01 22:27:55.041502+00', 1),
	('0ac92f7d-1e8e-4e82-8be0-1e1d50fa09ce', '4df4d69c-9c2f-4221-8816-5eae1947bd96', 'out', 12, 'Order #30', '2026-04-01 22:29:22.467293+00', 1),
	('b3c32ea2-8e4a-4434-a3a6-65c2099cf10b', 'c7fc94f5-471c-48c4-8385-126efafa3e3f', 'out', 1, 'Order #31', '2026-04-02 00:18:57.458486+00', 1),
	('84d11646-7c5f-486e-a951-6b66e774d669', 'c7fc94f5-471c-48c4-8385-126efafa3e3f', 'in', 1, 'Restored from cancelled order #31', '2026-04-02 00:19:39.303016+00', 1),
	('d2f1656c-de50-4a8f-92ce-c1605551627f', 'c7fc94f5-471c-48c4-8385-126efafa3e3f', 'out', 1, 'Order #32', '2026-04-02 00:20:07.625144+00', 1),
	('d315100a-482a-402c-b211-124917a84d90', 'c7fc94f5-471c-48c4-8385-126efafa3e3f', 'in', 1, 'Restored from cancelled order #32', '2026-04-02 00:20:55.002516+00', 1),
	('48a23987-fe84-4aa3-b746-8e716f563803', 'c7fc94f5-471c-48c4-8385-126efafa3e3f', 'in', 100, 'Purchase Order #16', '2026-04-02 00:28:06.679855+00', 1),
	('63db2b09-02c1-4504-9355-2f4c98e58000', 'c7fc94f5-471c-48c4-8385-126efafa3e3f', 'out', 100, 'Cancelled Purchase Order #16', '2026-04-02 00:28:39.580748+00', 1),
	('ef016a30-a041-43a5-ae81-497a9ad57201', 'c7fc94f5-471c-48c4-8385-126efafa3e3f', 'in', 1, 'Purchase Order #17', '2026-04-02 00:46:47.773851+00', 1),
	('9c2b7bf7-c28f-4902-8eb0-5f327add5c69', 'c7fc94f5-471c-48c4-8385-126efafa3e3f', 'out', 1, 'Cancelled Purchase Order #17', '2026-04-02 00:47:53.189955+00', 1),
	('2562a2d1-600e-4577-99bc-826001c33793', 'c7fc94f5-471c-48c4-8385-126efafa3e3f', 'in', 1, 'Purchase Order #18', '2026-04-02 00:53:17.437344+00', 1),
	('0d8a399f-486a-4f88-b909-5b53a86bd78e', 'c7fc94f5-471c-48c4-8385-126efafa3e3f', 'out', 1, 'Cancelled Purchase Order #18', '2026-04-02 00:53:59.88539+00', 1),
	('b2abd814-df64-4c5e-816a-5a8f9458a8c5', 'c7fc94f5-471c-48c4-8385-126efafa3e3f', 'in', 1, 'Purchase Order #19', '2026-04-02 01:04:06.827476+00', 1),
	('0e2db2c4-187b-4872-a35a-dfc11b123ca7', 'c7fc94f5-471c-48c4-8385-126efafa3e3f', 'out', 1, 'Cancelled Purchase Order #19', '2026-04-02 01:04:54.822139+00', 1),
	('f60f7205-d953-4921-b547-4e2ca55209a3', 'c7fc94f5-471c-48c4-8385-126efafa3e3f', 'in', 70, 'Purchase Order #20', '2026-04-02 01:26:03.420278+00', 1),
	('5cffa932-4915-4d06-b526-7397c77c4e0c', 'c7fc94f5-471c-48c4-8385-126efafa3e3f', 'out', 70, 'Cancelled Purchase Order #20', '2026-04-02 01:26:34.019004+00', 1),
	('19915b0e-eb9a-4c9a-9bc9-21671c5e9e4b', 'c7fc94f5-471c-48c4-8385-126efafa3e3f', 'out', 1, 'Order #33', '2026-04-02 01:27:47.696207+00', 1),
	('e79105a1-68b3-4a0e-bb9c-ca764d46dc2d', 'c7fc94f5-471c-48c4-8385-126efafa3e3f', 'in', 1, 'Restored from cancelled order #33', '2026-04-02 01:27:58.057176+00', 1),
	('55bb6d38-95f2-49a9-8a8b-2914d7c23068', 'c7fc94f5-471c-48c4-8385-126efafa3e3f', 'out', 1, 'Order #34', '2026-04-02 01:35:06.890824+00', 1),
	('d3f17fae-af8f-416c-8bfe-5304b5b84e31', 'c7fc94f5-471c-48c4-8385-126efafa3e3f', 'in', 1, 'Restored from cancelled order #34', '2026-04-02 01:35:28.983072+00', 1),
	('95a15f17-824b-4a7e-93ab-33ab5364430d', 'c7fc94f5-471c-48c4-8385-126efafa3e3f', 'in', 1, 'Restored from cancelled order #27', '2026-04-02 01:51:26.272674+00', 1),
	('3bfc724c-fd03-41f8-8f6c-93fda1b3ad8d', 'c7fc94f5-471c-48c4-8385-126efafa3e3f', 'out', 1, 'Order #35', '2026-04-02 01:52:43.948643+00', 1),
	('72a960cc-38bd-45c1-972d-a2934d521c9b', 'c7fc94f5-471c-48c4-8385-126efafa3e3f', 'out', 1, 'Order #36', '2026-04-02 01:54:31.353086+00', 1),
	('27dc772e-e65a-47ea-8d4b-abc04ab5031e', 'c7fc94f5-471c-48c4-8385-126efafa3e3f', 'in', 1, 'Purchase Order #21', '2026-04-02 01:55:09.315203+00', 1),
	('4368f6e2-088f-48f2-b955-33ab53c3630b', 'c7fc94f5-471c-48c4-8385-126efafa3e3f', 'out', 1, 'Cancelled Purchase Order #21', '2026-04-02 01:55:18.784549+00', 1),
	('97aa2ef5-e6ae-45a0-b236-4468d4933559', 'c7fc94f5-471c-48c4-8385-126efafa3e3f', 'out', 1, 'Order #37', '2026-04-02 03:06:53.358163+00', 1),
	('fa652878-1c7d-4ca6-9ce6-d70cf2a3abc3', 'c7fc94f5-471c-48c4-8385-126efafa3e3f', 'in', 1, 'Restored from cancelled order #37', '2026-04-02 03:08:35.143437+00', 1),
	('5093f9f8-5ec9-4e5c-976f-d049c053a192', 'c7fc94f5-471c-48c4-8385-126efafa3e3f', 'in', 1, 'Purchase Order #22', '2026-04-02 03:09:57.98071+00', 1),
	('7242c6de-b618-4573-922d-4ca67de4f72d', 'c7fc94f5-471c-48c4-8385-126efafa3e3f', 'out', 10, 'Order #38', '2026-04-02 03:21:18.791495+00', 1),
	('ec3a416d-8f62-4554-884e-7fef3ff9be4c', 'c7fc94f5-471c-48c4-8385-126efafa3e3f', 'out', 1, 'Order #39', '2026-04-02 03:35:39.90511+00', 1),
	('cbb95765-5b3a-4cec-940b-8e48f39d8af8', 'c7fc94f5-471c-48c4-8385-126efafa3e3f', 'in', 1, 'Restored from cancelled order #39', '2026-04-02 03:35:52.641552+00', 1),
	('c920027d-1aa8-437d-b174-c6866711bbf6', 'c7fc94f5-471c-48c4-8385-126efafa3e3f', 'out', 1, 'Order #40', '2026-04-02 10:03:53.568034+00', 1),
	('7747b5de-de89-4a73-a7cd-85c9cfd5fe22', 'c7fc94f5-471c-48c4-8385-126efafa3e3f', 'in', 1, 'Restored from cancelled order #40', '2026-04-02 10:04:19.028798+00', 1),
	('35241c9c-ac37-408e-aa7b-3404af53bf7d', 'c7fc94f5-471c-48c4-8385-126efafa3e3f', 'out', 1, 'Order #41', '2026-04-02 10:09:55.37349+00', 1),
	('c98a6330-862b-470e-a3d9-06cc74881ca5', 'c7fc94f5-471c-48c4-8385-126efafa3e3f', 'in', 1, 'Restored from cancelled order #41', '2026-04-02 10:10:09.566777+00', 1),
	('63f08e2d-702c-40c8-8f2a-6dfa2fecfff8', 'c7fc94f5-471c-48c4-8385-126efafa3e3f', 'in', 1, 'Purchase Order #23', '2026-04-02 10:11:36.316554+00', 1),
	('1a628aae-6c08-436c-9d77-20acf5ab52bf', 'c7fc94f5-471c-48c4-8385-126efafa3e3f', 'out', 1, 'Cancelled Purchase Order #23', '2026-04-02 10:12:10.350516+00', 1),
	('c623fe93-ff3d-47cf-bc2b-422e75635706', 'c7fc94f5-471c-48c4-8385-126efafa3e3f', 'in', 1, 'Purchase Order #24', '2026-04-02 10:27:24.672652+00', 1),
	('7d7d795e-b1fa-4f88-8ea6-5e4dedc2c23d', 'c7fc94f5-471c-48c4-8385-126efafa3e3f', 'out', 1, 'Cancelled Purchase Order #24', '2026-04-02 10:27:47.066452+00', 1),
	('b5f8c282-3aff-4221-adf2-7e918e2b73b2', 'c7fc94f5-471c-48c4-8385-126efafa3e3f', 'out', 1, 'Order #42', '2026-04-02 10:29:45.445266+00', 1),
	('5ddd1832-ba63-4b59-820a-8a00aa74ca74', 'c7fc94f5-471c-48c4-8385-126efafa3e3f', 'in', 1, 'Restored from cancelled order #42', '2026-04-02 10:29:59.105236+00', 1),
	('ee6a3799-83fa-4ea8-8836-00fb19a4eed5', 'c7fc94f5-471c-48c4-8385-126efafa3e3f', 'out', 1, 'Order #43', '2026-04-02 19:09:51.449742+00', 1),
	('7efb6578-c91a-48f4-914c-37abfa5744bd', 'c7fc94f5-471c-48c4-8385-126efafa3e3f', 'in', 1, 'Restored from cancelled order #43', '2026-04-02 19:10:30.782168+00', 1),
	('b75ab6dd-c639-427b-8288-83b8c548851b', 'c7fc94f5-471c-48c4-8385-126efafa3e3f', 'in', 1, 'Purchase Order #25', '2026-04-02 19:24:02.45533+00', 1),
	('d412151b-c62a-442c-b876-cbd83f8d38db', 'c7fc94f5-471c-48c4-8385-126efafa3e3f', 'out', 1, 'Cancelled Purchase Order #25', '2026-04-02 19:24:26.5455+00', 1),
	('bde2f5e5-ffc5-42ad-9492-eea2e95dba8c', 'c7fc94f5-471c-48c4-8385-126efafa3e3f', 'out', 1, 'Order #44', '2026-04-02 19:25:21.145454+00', 1),
	('224f83b9-0e5d-4cf1-a5b0-fde35f1400e6', 'c7fc94f5-471c-48c4-8385-126efafa3e3f', 'in', 1, 'Restored from cancelled order #44', '2026-04-02 19:25:35.276191+00', 1),
	('a6d43e24-011d-40f3-ab9e-2510371fe242', 'c7fc94f5-471c-48c4-8385-126efafa3e3f', 'out', 1, 'Order #45', '2026-04-02 19:34:55.415707+00', 1),
	('9af5686d-21bd-4744-ab2e-3e80038845eb', 'c7fc94f5-471c-48c4-8385-126efafa3e3f', 'in', 1, 'Restored from cancelled order #45', '2026-04-02 19:35:07.81397+00', 1),
	('b9e01981-c58a-433b-9bb2-3c4d2cea3737', 'c7fc94f5-471c-48c4-8385-126efafa3e3f', 'out', 1, 'Order #46', '2026-04-02 19:58:47.58034+00', 1),
	('e80f3db5-4457-435e-9353-2239d9d2a557', 'c7fc94f5-471c-48c4-8385-126efafa3e3f', 'in', 1, 'Restored from cancelled order #46', '2026-04-02 19:59:12.15443+00', 1),
	('4288163d-873d-4498-aff9-d61f40711374', 'c7fc94f5-471c-48c4-8385-126efafa3e3f', 'out', 1, 'Order #47', '2026-04-02 20:01:18.434207+00', 1),
	('391a6ee8-7457-481e-b928-9d3b51dd9e44', 'c7fc94f5-471c-48c4-8385-126efafa3e3f', 'in', 1, 'Restored from cancelled order #47', '2026-04-02 20:01:32.442498+00', 1),
	('f475ab8a-edef-4e9c-a6c2-97f2fd831ee2', 'c7fc94f5-471c-48c4-8385-126efafa3e3f', 'out', 1, 'Order #48', '2026-04-02 20:16:22.364709+00', 1),
	('d65edab5-aedb-4012-ace4-1ce5892ea08a', 'c7fc94f5-471c-48c4-8385-126efafa3e3f', 'in', 1, 'Restored from cancelled order #48', '2026-04-02 20:16:36.97373+00', 1),
	('0b44a5a6-65de-4656-84d1-090bfa40b4b6', 'c7fc94f5-471c-48c4-8385-126efafa3e3f', 'in', 1, 'Purchase Order #26', '2026-04-03 17:17:42.418749+00', 1),
	('3772cdd3-f065-4a58-a196-288591a51e02', 'c7fc94f5-471c-48c4-8385-126efafa3e3f', 'out', 1, 'Cancelled Purchase Order #26', '2026-04-03 17:18:04.469779+00', 1),
	('6303c368-e3fe-4fe7-a2a5-64cd0aa59e00', 'c7fc94f5-471c-48c4-8385-126efafa3e3f', 'in', 1, 'Purchase Order #27', '2026-04-03 17:47:59.532575+00', 1),
	('875bbf12-2738-46a5-95d5-ca2469cc47ed', '0427ab34-b940-49de-9de3-e2127a25070c', 'in', 455, 'Purchase Order #27', '2026-04-03 17:47:59.97216+00', 1),
	('b15ea068-e403-4865-823d-ae4adc808448', 'c7fc94f5-471c-48c4-8385-126efafa3e3f', 'out', 1, 'Order #49', '2026-04-03 18:23:48.916655+00', 1),
	('3c8746ec-0172-44d8-bfa8-11669d9eaf9b', 'c7fc94f5-471c-48c4-8385-126efafa3e3f', 'in', 1, 'Purchase Order #28', '2026-04-03 20:19:54.832642+00', 1),
	('f5d5e7af-1494-4be6-b55d-1c745d06ff37', 'c7fc94f5-471c-48c4-8385-126efafa3e3f', 'out', 1, 'Order #50', '2026-04-03 20:21:41.237737+00', 1),
	('60fbc162-86af-437c-b818-cb574549811d', 'c7fc94f5-471c-48c4-8385-126efafa3e3f', 'out', 10, 'Order #51', '2026-04-03 22:13:41.646577+00', 1),
	('41be64e9-05c0-44dd-8d7d-c63d2b0d64a1', 'c7fc94f5-471c-48c4-8385-126efafa3e3f', 'out', 1, 'Order #52', '2026-04-03 23:21:14.413389+00', 1),
	('13962a7e-b51f-4257-8677-0fd4797b5378', '38e5be56-bbc6-45af-ae50-f9569bfe6ca3', 'out', 15, 'Order #53', '2026-04-04 13:55:27.702843+00', 1),
	('c739acce-104c-414e-b032-9ad883bc41e5', 'c7fc94f5-471c-48c4-8385-126efafa3e3f', 'in', 1, 'Purchase Order #29', '2026-04-04 16:04:14.352117+00', 1),
	('82247743-1b65-4c34-9e08-ee7d4b4aa890', '0427ab34-b940-49de-9de3-e2127a25070c', 'in', 4, 'Purchase Order #29', '2026-04-04 16:04:14.873091+00', 1),
	('00a53a39-d42a-42c8-91c9-5d3f895334a3', 'c7fc94f5-471c-48c4-8385-126efafa3e3f', 'in', 1, 'Purchase Order #30', '2026-04-04 16:05:47.56399+00', 1),
	('23f7b2c4-a60b-4d01-bc84-c5be14659a3d', '0427ab34-b940-49de-9de3-e2127a25070c', 'in', 1, 'Purchase Order #30', '2026-04-04 16:05:47.900475+00', 1),
	('4f93eb20-f892-4005-beb4-32141c9060c4', 'c7fc94f5-471c-48c4-8385-126efafa3e3f', 'in', 1, 'Purchase Order #31', '2026-04-04 23:13:58.799644+00', 1),
	('ad38f17a-5376-46b7-97eb-741293982478', 'c7fc94f5-471c-48c4-8385-126efafa3e3f', 'in', 1, 'Purchase Order #32', '2026-04-04 23:15:36.914445+00', 1),
	('636fd818-2ef1-421c-b52a-8d0ac9fd747c', 'c7fc94f5-471c-48c4-8385-126efafa3e3f', 'in', 1, 'Purchase Order #33', '2026-04-04 23:24:01.986414+00', 1),
	('1d06fa73-4a60-4911-835c-48fc745b458e', '0427ab34-b940-49de-9de3-e2127a25070c', 'in', 15, 'Purchase Order #33', '2026-04-04 23:24:02.581041+00', 1),
	('4530e25e-2b84-4f82-8f1a-7f733d5e20bb', '38e5be56-bbc6-45af-ae50-f9569bfe6ca3', 'in', 1, 'Purchase Order #33', '2026-04-04 23:24:03.104584+00', 1),
	('377298d4-7115-4560-b334-4c93b12e8b3a', 'c7fc94f5-471c-48c4-8385-126efafa3e3f', 'out', 1, 'Order #54', '2026-04-07 20:12:02.552021+00', 1),
	('0072d344-ac32-4545-a295-15d1ae1c7516', 'c7fc94f5-471c-48c4-8385-126efafa3e3f', 'in', 1, 'Restored from cancelled order #54', '2026-04-07 20:13:13.433786+00', 1),
	('e4eaae6c-549c-4976-b5b2-761d133243ce', 'c7fc94f5-471c-48c4-8385-126efafa3e3f', 'out', 1, 'Order #55', '2026-04-07 20:15:19.228756+00', 1),
	('aab3b918-1536-4f7a-9037-183919c91052', 'c7fc94f5-471c-48c4-8385-126efafa3e3f', 'out', 1, 'Transfer #1 (out)', '2026-04-08 00:55:48.278827+00', 1),
	('9b146492-66c1-4c23-b33d-3757a88ad4ef', 'c7fc94f5-471c-48c4-8385-126efafa3e3f', 'in', 1, 'Transfer #1 (in)', '2026-04-08 00:55:48.278827+00', 2),
	('b4aff76c-24b0-4077-bc4a-8ac982f0da7c', 'c7fc94f5-471c-48c4-8385-126efafa3e3f', 'in', 1, 'Restored from cancelled order #57', '2026-04-08 02:46:50.070129+00', 1),
	('5e12718a-7127-47e4-97fe-02957cdf2b7a', 'c7fc94f5-471c-48c4-8385-126efafa3e3f', 'in', 1, 'Restored from cancelled order #55', '2026-04-08 02:47:35.826444+00', 1),
	('b668eab8-c0bf-4e98-a25f-0cada284e070', 'c7fc94f5-471c-48c4-8385-126efafa3e3f', 'in', 1, 'Restored from cancelled order #58', '2026-04-08 02:58:40.554042+00', 2),
	('795129db-8824-45c9-835c-e234b21989c2', 'c7fc94f5-471c-48c4-8385-126efafa3e3f', 'out', 1, 'Order #60', '2026-04-09 23:41:24.260458+00', 2);


--
-- Data for Name: buckets; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--



--
-- Data for Name: buckets_analytics; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--



--
-- Data for Name: buckets_vectors; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--



--
-- Data for Name: objects; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--



--
-- Data for Name: s3_multipart_uploads; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--



--
-- Data for Name: s3_multipart_uploads_parts; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--



--
-- Data for Name: vector_indexes; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--



--
-- Name: refresh_tokens_id_seq; Type: SEQUENCE SET; Schema: auth; Owner: supabase_auth_admin
--

SELECT pg_catalog.setval('"auth"."refresh_tokens_id_seq"', 17, true);


--
-- Name: inventory_transfers_transfer_number_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('"public"."inventory_transfers_transfer_number_seq"', 3, true);


--
-- Name: ledger_standalone_pi_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('"public"."ledger_standalone_pi_seq"', 11, true);


--
-- Name: ledger_standalone_py_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('"public"."ledger_standalone_py_seq"', 3, true);


--
-- Name: orders_order_number_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('"public"."orders_order_number_seq"', 1, false);


--
-- Name: purchase_orders_order_number_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('"public"."purchase_orders_order_number_seq"', 1, false);


--
-- Name: warehouses_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('"public"."warehouses_id_seq"', 2, true);


--
-- PostgreSQL database dump complete
--

-- \unrestrict wvhO9PGtS1YGYddm3YdL2Xod1TUk28mePD9bohRAe7xSBsmKzMK1jquEKYQjBrM

RESET ALL;
