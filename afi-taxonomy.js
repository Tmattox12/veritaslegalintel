/* Arizona AFI-aligned expense taxonomy.
 *
 * Aligned with Arizona Supreme Court Form AFI (Affidavit of Financial Information)
 * Used in child support and spousal maintenance cases per A.R.S. § 25-320 et seq.
 *
 * Structure mirrors the AFI sections as they appear on the official form:
 *   1  Health Insurance Premiums         - mandatory disclosure
 *   2  Childcare and School Age Care    - work-related childcare
 *   3  Unreimbursed Medical/Dental/Vision - actual out-of-pocket
 *   4  Tuition for Private/College      - education expenses
 *   5  Rent or Mortgage Payment         - housing costs
 *   6  Utilities                        - essential utilities
 *   7  Transportation                   - vehicle and transit
 *   8  Groceries and Household Items    - food and supplies
 *   9  Court-Ordered Support Payments   - existing support obligations
 *   10 Other Expenses                   - debts, legal, other
 *
 * Legal basis: Arizona Supreme Court Child Support Guidelines,
 * A.R.S. § 25-320 (child support), A.R.S. § 25-319 (spousal maintenance).
 *
 * Categories not on the form (discretionary, excluded, transfers) are reported
 * separately so they don't inflate support calculations.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.AFITaxonomy = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const SECTIONS = [
    { key: 'health_insurance', label: 'Section 1: Health Insurance Premiums', afiSection: '1', legalBasis: 'A.R.S. § 25-320(A)(1)' },
    { key: 'childcare', label: 'Section 2: Childcare & School Age Care', afiSection: '2', legalBasis: 'A.R.S. § 25-320(A)(2)' },
    { key: 'medical_unreimbursed', label: 'Section 3: Unreimbursed Medical/Dental/Vision', afiSection: '3', legalBasis: 'A.R.S. § 25-320(A)(3)' },
    { key: 'tuition', label: 'Section 4: Tuition (Private/College)', afiSection: '4', legalBasis: 'A.R.S. § 25-320(A)(4)' },
    { key: 'housing', label: 'Section 5: Rent or Mortgage Payment', afiSection: '5', legalBasis: 'A.R.S. § 25-320(A)(5)' },
    { key: 'utilities', label: 'Section 6: Utilities', afiSection: '6', legalBasis: 'A.R.S. § 25-320(A)(6)' },
    { key: 'transportation', label: 'Section 7: Transportation', afiSection: '7', legalBasis: 'A.R.S. § 25-320(A)(7)' },
    { key: 'food_household', label: 'Section 8: Groceries & Household Items', afiSection: '8', legalBasis: 'A.R.S. § 25-320(A)(8)' },
    { key: 'court_ordered', label: 'Section 9: Court-Ordered Support Payments', afiSection: '9', legalBasis: 'A.R.S. § 25-320(A)(9)' },
    { key: 'other_expenses', label: 'Section 10: Other Expenses', afiSection: '10', legalBasis: 'A.R.S. § 25-320(A)(10)' },
    { key: 'discretionary', label: 'Discretionary / Lifestyle Expenses', afiSection: null, legalBasis: 'Not reportable on AFI' },
    { key: 'excluded', label: 'Excluded — Not Allowed in Support Calc', afiSection: null, legalBasis: 'A.R.S. § 25-320(B)' },
    { key: 'non_expense', label: 'Not an Expense (Income / Transfers)', afiSection: null, legalBasis: null },
  ];

  // treatment drives how a total may be used:
  //   need          - supports a claim of financial need (basic living)
  //   support       - court-ordered support in or out
  //   debt          - obligation affecting ability to pay
  //   legal         - case cost, may be allocated
  //   discretionary - lifestyle, reported but never a "need"
  //   excluded      - must not appear in AFI totals
  //   none          - income, transfers: not spending at all
  const C = (code, section, subsection, label, treatment) =>
    ({ code, section, subsection, label, treatment });

  const CATEGORIES = [
    // ---- Section 1: Health Insurance Premiums ----------------------------
    C('health_self_premium', 'health_insurance', 'Self', 'Your health insurance premium', 'need'),
    C('health_spouse_premium', 'health_insurance', 'Spouse', 'Spouse/other parent health insurance premium', 'need'),
    C('health_child_premium', 'health_insurance', 'Children', "Children's health insurance premium", 'need'),
    C('dental_vision_self', 'health_insurance', 'Self', 'Dental / vision insurance (self)', 'need'),
    C('dental_vision_child', 'health_insurance', 'Children', "Dental / vision insurance (children's)", 'need'),

    // ---- Section 2: Childcare & School Age Care ---------------------------
    C('childcare_daycare', 'childcare', 'Work-Related Childcare', 'Daycare / preschool', 'need'),
    C('childcare_afterschool', 'childcare', 'Work-Related Childcare', 'After-school care / latchkey', 'need'),
    C('childcare_summer', 'childcare', 'Work-Related Childcare', 'Summer camp / care', 'need'),
    C('childcare_babysitter', 'childcare', 'Work-Related Childcare', 'Babysitting (work-related)', 'need'),
    C('childcare_nanny', 'childcare', 'Work-Related Childcare', 'Nanny / in-home care', 'need'),

    // ---- Section 3: Unreimbursed Medical/Dental/Vision --------------------
    C('medical_unreimbursed_self', 'medical_unreimbursed', 'Self', 'Unreimbursed medical / dental / vision (self)', 'need'),
    C('medical_unreimbursed_child', 'medical_unreimbursed', 'Children', 'Unreimbursed medical / dental / vision (children)', 'need'),
    C('prescriptions_self', 'medical_unreimbursed', 'Self', 'Prescriptions and medications (self)', 'need'),
    C('prescriptions_child', 'medical_unreimbursed', 'Children', 'Prescriptions and medications (children)', 'need'),
    C('therapy_child', 'medical_unreimbursed', 'Children', 'Therapy / special needs services', 'need'),
    C('medical_equipment', 'medical_unreimbursed', 'Medical Equipment', 'Medical equipment / supplies', 'need'),

    // ---- Section 4: Tuition (Private School / College) --------------------
    C('tuition_private_elementary', 'tuition', 'Private School', 'Private elementary school tuition', 'need'),
    C('tuition_private_secondary', 'tuition', 'Private School', 'Private secondary school tuition', 'need'),
    C('tuition_college', 'tuition', 'College/University', 'College / university tuition', 'need'),
    C('tuition_vocational', 'tuition', 'Vocational/Technical', 'Vocational / technical school tuition', 'need'),
    C('school_books_supplies', 'tuition', 'School Expenses', 'Books and school supplies', 'need'),
    C('school_technology', 'tuition', 'School Expenses', 'Technology / computers', 'need'),
    C('school_fees', 'tuition', 'School Expenses', 'School fees and activities', 'need'),

    // ---- Section 5: Rent or Mortgage Payment ------------------------------
    C('housing_rent', 'housing', 'Housing Payment', 'Rent payment', 'need'),
    C('housing_mortgage', 'housing', 'Housing Payment', 'Mortgage payment', 'need'),
    C('housing_property_tax', 'housing', 'Housing Expenses', 'Property taxes', 'need'),
    C('housing_insurance', 'housing', 'Housing Expenses', "Homeowner's / renter's insurance", 'need'),
    C('housing_hoa', 'housing', 'Housing Expenses', 'HOA / condo fees', 'need'),
    C('housing_maintenance_repair', 'housing', 'Housing Expenses', 'Repairs and maintenance', 'need'),

    // ---- Section 6: Utilities ---------------------------------------------
    C('utilities_electric', 'utilities', 'Essential Utilities', 'Electricity', 'need'),
    C('utilities_gas', 'utilities', 'Essential Utilities', 'Natural gas', 'need'),
    C('utilities_water_sewer', 'utilities', 'Essential Utilities', 'Water / sewer / garbage', 'need'),
    C('utilities_internet', 'utilities', 'Essential Utilities', 'Internet / data', 'need'),
    C('utilities_phone', 'utilities', 'Essential Utilities', 'Cell phone / mobile', 'need'),
    C('utilities_basic_cable', 'utilities', 'Essential Utilities', 'Basic cable (news/communication only)', 'need'),

    // ---- Section 7: Transportation ----------------------------------------
    C('transport_car_payment', 'transportation', 'Vehicle Payment', 'Car payment / lease', 'need'),
    C('transport_car_insurance', 'transportation', 'Vehicle Expenses', 'Auto insurance', 'need'),
    C('transport_fuel', 'transportation', 'Vehicle Expenses', 'Fuel / gasoline', 'need'),
    C('transport_maintenance_repair', 'transportation', 'Vehicle Expenses', 'Repairs and maintenance', 'need'),
    C('transport_registration_license', 'transportation', 'Vehicle Expenses', 'Vehicle registration / license', 'need'),
    C('transport_public_transit', 'transportation', 'Alternative Transportation', 'Public transportation / transit', 'need'),
    C('transport_parking', 'transportation', 'Alternative Transportation', 'Parking', 'need'),

    // ---- Section 8: Groceries & Household Items ---------------------------
    C('food_groceries', 'food_household', 'Food', 'Groceries', 'need'),
    C('food_school_lunch', 'food_household', 'Food', 'School lunches', 'need'),
    C('household_supplies', 'food_household', 'Household Items', 'Household cleaning supplies', 'need'),
    C('household_paper_products', 'food_household', 'Household Items', 'Paper products / toiletries', 'need'),
    C('laundry_clothing', 'food_household', 'Clothing Care', 'Laundry / dry cleaning', 'need'),
    C('clothing_replacement', 'food_household', 'Clothing', 'Clothing (replacement / maintenance)', 'need'),

    // ---- Section 9: Court-Ordered Support Payments ------------------------
    C('support_child_paid', 'court_ordered', 'Child Support', 'Child support paid', 'support'),
    C('support_child_received', 'court_ordered', 'Child Support', 'Child support received', 'support'),
    C('support_child_arrears', 'court_ordered', 'Child Support', 'Child support arrears / past due', 'support'),
    C('support_spousal_paid', 'court_ordered', 'Spousal Maintenance', 'Spousal maintenance / alimony paid', 'support'),
    C('support_spousal_received', 'court_ordered', 'Spousal Maintenance', 'Spousal maintenance / alimony received', 'support'),
    C('support_spousal_arrears', 'court_ordered', 'Spousal Maintenance', 'Spousal maintenance arrears / past due', 'support'),

    // ---- Section 10: Other Expenses ----------------------------------------
    C('debt_auto_loan', 'other_expenses', 'Secured Debt', 'Auto loan payment', 'debt'),
    C('debt_heloc', 'other_expenses', 'Secured Debt', 'HELOC / home equity loan payment', 'debt'),
    C('debt_mortgage_2nd', 'other_expenses', 'Secured Debt', 'Second mortgage / junior lien', 'debt'),
    C('debt_credit_card', 'other_expenses', 'Unsecured Debt', 'Credit card payment', 'debt'),
    C('debt_personal_loan', 'other_expenses', 'Unsecured Debt', 'Personal loan payment', 'debt'),
    C('debt_medical', 'other_expenses', 'Unsecured Debt', 'Medical debt / collection', 'debt'),
    C('debt_student_loan', 'other_expenses', 'Student Loans', 'Student loan payment', 'debt'),
    C('debt_garnishment', 'other_expenses', 'Court-Ordered Debt', 'Wage garnishment / court judgment', 'debt'),
    C('legal_attorney_fees', 'other_expenses', 'Legal Expenses', 'Attorney fees / legal retainer', 'legal'),
    C('legal_expert_witness', 'other_expenses', 'Legal Expenses', 'Expert witness / appraisal fees', 'legal'),
    C('legal_court_costs', 'other_expenses', 'Legal Expenses', 'Court filing / mediation / evaluation fees', 'legal'),

    // ---- Discretionary / Lifestyle Expenses --------------------------------
    C('disc_dining_out', 'discretionary', 'Entertainment & Dining', 'Dining out / restaurants', 'discretionary'),
    C('disc_entertainment', 'discretionary', 'Entertainment & Dining', 'Movies / concerts / events', 'discretionary'),
    C('disc_vacation_travel', 'discretionary', 'Travel & Recreation', 'Vacations / leisure travel', 'discretionary'),
    C('disc_streaming', 'discretionary', 'Subscriptions', 'Streaming services (entertainment)', 'discretionary'),
    C('disc_gym_fitness', 'discretionary', 'Subscriptions', 'Gym / fitness membership', 'discretionary'),
    C('disc_subscriptions', 'discretionary', 'Subscriptions', 'Other subscriptions / memberships', 'discretionary'),
    C('disc_pets', 'discretionary', 'Pets', 'Pet food / veterinary / grooming', 'discretionary'),
    C('disc_beauty_spa', 'discretionary', 'Personal Lifestyle', 'Beauty / spa / salon services', 'discretionary'),
    C('disc_alcohol_tobacco', 'discretionary', 'Personal Lifestyle', 'Alcohol / tobacco / cannabis', 'discretionary'),
    C('disc_shopping', 'discretionary', 'Personal Lifestyle', 'General retail / shopping', 'discretionary'),
    C('disc_gifts', 'discretionary', 'Gifts & Charity', 'Gifts / presents / holiday spending', 'discretionary'),

    // ---- Excluded - NOT Allowed in Support Calculations -------------------
    C('excl_business_expense', 'excluded', 'Business', 'Business expense / business tax', 'excluded'),
    C('excl_business_investment', 'excluded', 'Business', 'Business investment / capital expenditure', 'excluded'),
    C('excl_non_party_expense', 'excluded', 'Non-Party', 'Expense for non-party individual', 'excluded'),
    C('excl_luxury_non_essential', 'excluded', 'Luxury Items', 'Luxury / non-essential purchase', 'excluded'),
    C('excl_investment_contribution', 'excluded', 'Investments', 'Investment / retirement contribution', 'excluded'),

    // ---- Not Spending (Income, Transfers, Non-Expense Items) ---------------
    C('income_wages', 'non_expense', 'Income', 'Wages / salary / employment income', 'none'),
    C('income_bonus', 'non_expense', 'Income', 'Bonus / commission', 'none'),
    C('income_self_employed', 'non_expense', 'Income', 'Self-employment income', 'none'),
    C('income_investment', 'non_expense', 'Income', 'Dividend / interest / investment income', 'none'),
    C('income_other', 'non_expense', 'Income', 'Other income source', 'none'),
    C('transfer_account', 'non_expense', 'Transfers', 'Transfer between own accounts', 'none'),
    C('transfer_investment', 'non_expense', 'Transfers', 'Investment transfer / reallocation', 'none'),
    C('transfer_other_person', 'non_expense', 'Transfers', 'Transfer to other person (non-support)', 'none'),
    C('cash_withdrawal', 'non_expense', 'Cash', 'Cash withdrawal (purpose unknown)', 'none'),
    C('tax_payment', 'non_expense', 'Tax', 'Income tax payment / withholding', 'none'),
    C('tax_refund', 'non_expense', 'Tax', 'Tax refund / credit', 'none'),
  ];

  const BY_CODE = CATEGORIES.reduce((m, c) => { m[c.code] = c; return m; }, {});

  // The eight inputs on afi-form-populator.html, kept as the roll-up target.
  const AFI_LINES = [
    { line: 1, label: 'Health Insurance Premium' },
    { line: 2, label: 'Childcare/Dependent Care' },
    { line: 3, label: 'Medical/Dental (Out-of-Pocket)' },
    { line: 4, label: 'Education/Books/Supplies' },
    { line: 5, label: 'Housing (Mortgage/Rent)' },
    { line: 6, label: 'Utilities (Phone/Internet/Cable)' },
    { line: 7, label: 'Transportation (Car/Gas/Insurance)' },
    { line: 8, label: 'Food/Groceries' },
  ];

  // Categories carried by rows parsed before this taxonomy existed.
  const LEGACY_ALIASES = {
    groceries: 'food_groceries',
    dining: 'disc_dining',
    shopping: 'disc_shopping',
    fuel: 'transport_fuel',
    utilities: 'utilities_electric',
    housing: 'housing_rent_mortgage',
    medical: 'medical_unreimbursed',
    childcare: 'childcare_daycare',
    insurance: 'medical_premium',
    education: 'education_tuition',
    employment_income: 'employment_income',
    transfer: 'transfer',
    tax: 'tax',
  };

  const REVIEW = 'review';

  // Order matters: the first match wins, so rules that disambiguate a brand
  // from what was actually bought must come before the brand rules.
  const RULES = [
    // --- court-ordered support, read before anything else --------------------
    [/\bchild\s*support\b|\bcs\s*payment\b|\bsupport\s*payment\b.*\bchild\b/i, 'child_support_paid'],
    [/\bspousal\s*(?:maintenance|support)\b|\balimony\b|\bmaintenance\s*payment\b/i, 'spousal_paid'],
    [/\bgarnish|\brestitution\b|\bjudgment\s*(?:payment|lien)\b|\blevy\b/i, 'debt_garnishment'],

    // --- legal / case costs --------------------------------------------------
    [/\battorney\b|\blaw\s*(?:office|firm|group|gro)\b|\blegal\s*fees?\b|\bretainer\b|\bpllc\b|\bllp\b|\bfamily\s*law\b|\bkarp\s*&?\s*weiss\b|\bbelleau\b/i, 'legal_attorney_fees'],
    // A CPA may be forensic accounting for the case or ordinary tax prep.
    [/\bcpa\b/i, 'legal_professional', REVIEW],
    [/\bmediation\b|\bfiling\s*fee\b|\bclerk\s*of\s*(?:the\s*)?court\b|\bparenting\s*coordinator\b|\bsuperior\s*court\b/i, 'legal_court_costs'],
    [/\bforensic\s*account|\bcustody\s*evaluat|\bbusiness\s*valuation\b|\bexpert\s*witness\b/i, 'legal_professional'],

    // --- disambiguators ------------------------------------------------------
    // Piped gas is a household utility; vehicle fuel is transportation.
    [/\bsouthwest\s*gas\b|\bnatural\s*gas\b|\bgas\s*(?:company|co\b|utility)/i, 'utilities_gas'],
    // "FUEL1521" has no trailing word boundary, so do not anchor the end.
    [/\bfuel|\bgasoline\b/i, 'transport_fuel'],
    // Streaming is a discretionary subscription, never a utility.
    [/\bnetflix\b|\bhulu\b|\bdisney\s*\+|\bhbo\s*max\b|\bparamount\s*\+|\bpeacock\b|\bspotify\b|\bpandora\b|\bprime\s*video\b|\bamazon\s*prime\b|\bamzn\s*prime\b|\byoutube\s*(?:tv|premium)\b|\bsling\s*tv\b|apple\.?com\/?bill|\bapplecombill\b|\bitunes\b/i, 'disc_streaming'],
    [/\bplanet\s*fitness\b|\bla\s*fitness\b|\bgold'?s\s*gym\b|\banytime\s*fitness\b|\borange\s*theory\b|\bpeloton\b|\bgym\b|\bcrossfit\b/i, 'disc_gym'],
    [/\bdisney\s*plus\b/i, 'disc_streaming'],

    // --- specific merchants seen in discovery, high confidence ---------------
    // QuikTrip prints as "QT 1234"; order ids like "*QT8SZ" must not match.
    [/(?:^|\s)qt\s+#?\s*\d|(?:^|\s)qt\s+outside\b/i, 'transport_fuel'],
    [/\bmister\s*car\s*wash\b|\bcar\s*wash\b/i, 'transport_maintenance_repair'],
    [/\buber\s*\*?\s*trip\b|\blyft\b/i, 'transport_public_transit'],
    [/\bwaste\s*mgmt\b/i, 'utilities_water'],
    [/\bswpestsolutions\b|\bpest\s*solutions\b/i, 'housing_maintenance_repair'],
    [/\bsams\s*scan|\bwholefds\b|\bwm\s*supercenter\b/i, 'food_groceries'],
    [/\bbanner\s*(?:health|univ)|\brincon\s*asc\b|\bpathology\s*specialists\b|\bliver\s*health\b|\bkidney\s*institut|\blaboratory\s*corporation\b|\bchiropractic\b|\bphysical\s*medicin|\bm\.?d\.?,?\s*p\b|\bmychart\b/i, 'medical_unreimbursed'],
    [/\bbarber|\bgreat\s*clips\b|\bsupercuts\b|\bsport\s*clips\b/i, 'personal_grooming'],
    [/\bulta\b|\bsephora\b|\bthrivecausemetics\b/i, 'disc_beauty'],
    [/\btaekwondo\b|\bmartial\s*arts\b/i, 'child_activities'],
    [/\bamphitheater\s*public\s*scho|\bpima\s*county\s*amphithea|\bpublic\s*schools?\b/i, 'school_fees'],
    [/\bhtl\s*\*|\bhampton\s*inn|\bhamptoninn|\bsonesta\b|\bclarion\s*hotels?\b|\bcourtyard\b|\bdays\s*inns?\b|\bdaysinn|\bhotels\.?com\b|\bhotelcom\b|\bvrbo\b/i, 'disc_travel'],
    [/\btopgolf\b|\bcinemas?\b|\bultrasignup\b|\braceroster\b|\bmarathon\b(?!\s*(?:petro|gas))|\bstate\s*park\b|\bfarm\s*festival|\bpumpkin\s*pa/i, 'disc_entertainment'],
    // TST* is the Toast point-of-sale, used almost exclusively by restaurants.
    [/\btst\s*\*|\bristorante\b|\bin-n-out\b|\bchick-fil-a\b|\bjimmy\s*johns\b|\bdairy\s*queen\b|\bburger\s*king\b|\barbys\b|\bwingstop\b|\bdunkin\b|\bcrumbl\b|\btrue\s*food\s*kitchen\b|\bhandels\s*homemade\b|\bchoice\s*greens\b|\bpitalian\b|\bpizzeria\b|\bpizza\b/i, 'disc_dining'],
    [/\blululemon|\bpatagonia\b|\bathleta\b|\bnew\s*balance\b|\bnewbalance\b|\bvans\.com\b|\bzara\b|\bann\s*taylor|\banntaylor\b|\bloft\.com\b|\banthropologie\b|\bjcpenney\b|\bspanx\b|\bkipling\b|\bpatriot\s*jean|\blifeisgood\b|\bold\s*navy\b|\bgap\b/i, 'clothing'],
    [/\blulu\s*and\s*georgia\b|\bpotterybarn\b|\bpottery\s*barn\b|\bashley\s*furniture|\bashleyfurniture|\bmagnolia\s*market\b|\bcrate\s*and\s*barrel\b|\ble\s*creuset\b|\bdecor\s*steals\b|\bhobby-?\s*lobby\b|\bthule\b|\bultimate\s*sack\b/i, 'disc_shopping'],
    [/\bpet\s*supplies\s*plus\b/i, 'disc_pets'],
    [/\bautomatic\s*payment\s*-?\s*thank\s*you\b|\bcredit\s*crd\s*autopay\b/i, 'debt_credit_card'],
    [/\bedward\s*jones\s*investment\b|\bbuy\s+american\s+growth\b/i, 'investment_transfer'],

    // --- recognisable merchant, category is a best guess: flag for review ----
    // Brokerage credit; likely an investment transfer, not yet confirmed.
    [/\bmanual\s*cr-?\s*bkrg\b/i, 'investment_transfer', REVIEW],
    // Capital gains can be income for support purposes - never assume otherwise.
    [/\bcapital\s*gain\b|\bdividend\b/i, 'other_income', REVIEW],
    // Incoming ACH from a business via QuickBooks or Stripe: likely pay for work.
    [/\bquickbooks\b/i, 'employment_income', REVIEW],
    [/\bstripe\b/i, 'other_income', REVIEW],
    [/\bwakefiel\b/i, 'other_income', REVIEW],
    [/\bredemption\s*credit\b|\bpayyourselfback\b/i, 'other_income', REVIEW],
    [/\bwestern\s*union\b|\bwu\s*\*|\bwuvisaaft\b/i, 'transfer', REVIEW],
    [/\btransaction\s*fee\b/i, 'debt_credit_card', REVIEW],
    // Licensed therapist: could be the parent's own care or the child's.
    [/\blcsw\b|\blpc\b|\blmft\b|\bpsychologist\b/i, 'medical_unreimbursed', REVIEW],
    [/\bbraces\b|\borthodont/i, 'medical_unreimbursed_child', REVIEW],
    [/\blmt\b|\bmassage\b/i, 'disc_beauty', REVIEW],
    [/\bgloss\s*\*|\ballisonwade\b/i, 'disc_beauty', REVIEW],
    [/\bintimina\b|\bus\s*intimn\b/i, 'personal_hygiene', REVIEW],
    [/\bmvd\b|\btitle\s*&\s*tag\b/i, 'transport_registration_license', REVIEW],
    [/\bu-?haul\b|\bmoving\s*&\s*labo|\bmoving\s*and\s*labor\b/i, 'housing_maintenance_repair', REVIEW],
    [/\bschool\s*of\s*real\b/i, 'education_tuition', REVIEW],
    [/\bymca\b|\badventures\b/i, 'child_activities', REVIEW],
    [/\bblockfit|\bworden\s*physique\b|\bbdyfttrng\b|\bmelt\s*method\b|\bbare\s*performance\b|\bchoose\s*strong\b|\bdeliciouslyfit/i, 'disc_gym', REVIEW],
    [/\bcycling\b|\bbicycle\b/i, 'disc_entertainment', REVIEW],
    [/\broad\s*house\s*roadies\b|\broadhouse\s*roadies\b|\bdolce\s*pastello\b|\bdolcepastello|\bcookie\s*cabin\b|\bbottega\b|\bthe\s*landing\b|\bkitchen\b|\bharvest\b/i, 'disc_dining', REVIEW],
    [/\btory\s*burch\b/i, 'excl_luxury', REVIEW],
    [/\bdyson\b|\bthermomix\b|\bcoros\b/i, 'disc_shopping', REVIEW],
    [/\bgoodr\b|\bizipizi\b|\bprocompression\b/i, 'clothing', REVIEW],
    [/\bwmt\s*plus\b/i, 'disc_subscription_other', REVIEW],
    [/\bwm\.com\b/i, 'food_groceries', REVIEW],
    [/\blaird\s*superfood\b|\bthefeed\b/i, 'food_groceries', REVIEW],
    [/\busps\b|\bups\s*store\b|\bfedex\b/i, 'disc_shopping', REVIEW],
    [/\btractor\s*supply\b|\bshoptoro\b|\biconic\s*arizona\b/i, 'disc_shopping', REVIEW],
    [/\bgiv\s*\*|\bbens\s*bells\b|\bdonation\b|\bcharit/i, 'disc_gifts', REVIEW],
    [/\bdamage\s*insuran|\blimo\s*service\b/i, 'disc_travel', REVIEW],

    // --- child-related -------------------------------------------------------
    [/\bday\s*care\b|\bdaycare\b|\bchild\s*care\b|\bchildcare\b|\bpreschool\b|\bmontessori\b/i, 'childcare_daycare'],
    [/\bafter\s*school\b|\bboys\s*&?\s*girls\s*club\b|\bymca\s*(?:child|kids|after)/i, 'childcare_afterschool'],
    [/\bbabysit|\bnanny\b/i, 'childcare_babysitting'],
    [/\btuition\b|\bschool\s*(?:district|fees?)\b|\btusd\b|\bacademy\b|\bcharter\s*school\b/i, 'education_tuition'],
    [/\bbookstore\b|\bscholastic\b|\bpearson\b|\btextbook/i, 'education_books'],
    [/\bschool\s*supplies\b|\bstaples\b|\boffice\s*(?:depot|max)\b/i, 'education_supplies'],
    [/\bsoccer\b|\blittle\s*league\b|\bdance\s*(?:studio|class)\b|\bmusic\s*lesson|\bsummer\s*camp\b|\bkarate\b|\bgymnastics\b/i, 'child_activities'],
    [/\btherapy\b|\btherapist\b|\bspeech\s*path|\boccupational\s*therap|\bcounsel(?:ing|or)\b/i, 'child_therapy'],

    // --- medical -------------------------------------------------------------
    [/\bblue\s*cross\b|\bbcbs?\b|\bunited\s*health|\baetna\b|\bcigna\b|\bhumana\b|\bkaiser\b|\bhealth\s*insur|\bambetter\b|\boscar\s*health\b/i, 'medical_premium'],
    [/\bdelta\s*dental\b|\bvsp\b|\bvision\s*insur|\bdental\s*insur/i, 'medical_dental_vision_premium'],
    [/\bcvs\b|\bwalgreens?\b|\brite\s*aid\b|\bpharmacy\b|\bprescription\b/i, 'medical_prescriptions'],
    [/\b(?:derm|dent|ortho|optom|clinic|medical|urgent\s*care|labcorp|quest\s*diag|hospital|physician|pediatric|radiolog|anesthes)/i, 'medical_unreimbursed'],

    // --- housing -------------------------------------------------------------
    [/\bmortgage\b|\bloan\s*servicing\b|\bmr\s*cooper\b|\bpennymac\b|\bfreedom\s*mortgage\b/i, 'housing_rent_mortgage'],
    // Confirmed by counsel as a recurring rent/mortgage payment.
    [/\btucson\s*crossroads?\b/i, 'housing_rent_mortgage'],
    [/\brent\b|\bapartment|\bproperty\s*management\b|\bleasing\b/i, 'housing_rent_mortgage'],
    [/\bhoa\b|\bhome\s*owners?\s*assoc|\bcommunity\s*assoc/i, 'housing_hoa'],
    [/\bproperty\s*tax\b|\btreasurer\b.*\btax\b|\bcounty\s*tax\b/i, 'housing_property_tax'],
    [/\bhome\s*owners?\s*insur|\bhomeowners\b|\bhazard\s*insur/i, 'housing_insurance'],
    [/\bhome\s*depot\b|\blowe'?s\b|\bace\s*hardware\b|\bplumb|\bhvac\b|\broofing\b|\bpest\s*control\b|\blandscap|\bpool\s*service\b/i, 'housing_maintenance'],

    // --- utilities -----------------------------------------------------------
    [/\btep\b|\btucson\s*electric\b|\baps\b|\bsrp\b|\belectric\s*(?:co|company|utility)\b|\bpg&e\b/i, 'utilities_electric'],
    [/\bwater\b|\bsewer\b|\btrash\b|\bwaste\s*management\b|\bwm\s*waste\b|\brefuse\b|\bsanitation\b|\b(?:town|city)\s*of\s+/i, 'utilities_water'],
    [/\bverizon\b|\bat&?t\b|\bt-?mobile\b|\bsprint\b|\bcricket\b|\bmint\s*mobile\b/i, 'utilities_phone'],
    [/\bcomcast\b|\bxfinity\b|\bcox\b|\bcenturylink\b|\bspectrum\b|\bearthlink\b|\binternet\b/i, 'utilities_internet'],
    [/\bcable\b|\bdirectv\b|\bdish\s*network\b/i, 'utilities_basic_cable'],

    // --- transportation ------------------------------------------------------
    [/\bgeico\b|\bstate\s*farm\b|\bprogressive\b|\ballstate\b|\busaa\b|\bauto\s*insur/i, 'transport_car_insurance'],
    [/\bchevron\b|\bshell\b|\bcircle\s*k\b|\barco\b|\bexxon\b|\bmobil\b|\bspeedway\b|\bquiktrip\b|\bvalero\b|\bsinclair\b|\bpilot\s*travel\b|\bmarathon\s*(?:petro|gas)|\bmaverik\b|\bconoco\b|\bphillips\s*66\b|\bloves?\s*travel\b/i, 'transport_fuel'],
    [/\bjiffy\s*lube\b|\bmidas\b|\btire\b|\bauto\s*zone\b|\bo'?reilly\b|\bnapa\s*auto\b|\bpep\s*boys\b|\bdiscount\s*tire\b|\bcollision\b|\bauto\s*repair\b|\bauto\s*m(?:all|otive)?\b|\bhonda\b|\btoyota\b|\bford\b|\bsubaru\b|\bnissan\b|\bdealership\b/i, 'transport_maintenance'],
    [/\bparking\b|\bsun\s*tran\b|\btransit\b|\bmetro\s*(?:card|rail)\b|\btoll\b/i, 'transport_parking_transit'],
    [/\bauto\s*loan\b|\bvehicle\s*loan\b|\bcar\s*payment\b|\bally\s*auto\b|\bcapital\s*one\s*auto\b/i, 'transport_car_payment'],

    // --- food ----------------------------------------------------------------
    [/\bdoordash\b|\buber\s*eats\b|\bgrubhub\b|\bpostmates\b|\brestaurant\b|\bpizza\b|\bstarbucks\b|\bdutch\s*bros\b|\bmcdonald|\bchipotle\b|\btaco\b|\bgrill\b|\bcafe\b|\bbar\s*&\s*grill\b|\bgastropub\b|\bbrewing\b/i, 'disc_dining'],
    [/\bwalmart\b|\bwal-?mart\b|\bsafeway\b|\bsams ?club\b|\bcostco\b|\bkroger\b|\bfry'?s\b|\balbertsons?\b|\btrader\s*joe'?s?\b|\bwhole\s*foods?\b|\bsprouts?\b|\bdollar\s*(?:tree|general)\b|\baldi\b|\bfood\s*city\b|\bel\s*super\b|\bbashas\b|\bwin-?co\b|\bgrocery\b/i, 'food_groceries'],

    // --- debts ---------------------------------------------------------------
    [/\bstudent\s*loan\b|\bnavient\b|\bnelnet\b|\bsallie\s*mae\b|\bgreat\s*lakes\s*(?:ed|servic)/i, 'debt_student_loan'],
    [/\bheloc\b|\bhome\s*equity\b/i, 'debt_heloc'],
    [/\bcard\s*payment\b|\bpayment\s*to\s*(?:chase|credit|card)\b|\bpayment\s*thank\s*you\b/i, 'debt_credit_card'],
    [/\bpersonal\s*loan\b|\blending\s*club\b|\bupstart\b|\bavant\b/i, 'debt_personal_loan'],

    // --- discretionary -------------------------------------------------------
    [/\bpetco\b|\bpetsmart\b|\bveterinar|\bvet\s*clinic\b|\bchewy\b|\bgrooming\b.*\bpet\b/i, 'disc_pets'],
    [/\bsalon\b|\bspa\b|\bnails?\b|\bmassage\b|\bhair\b/i, 'disc_beauty'],
    [/\bliquor\b|\bwine\b|\bspirits\b|\bbrewery\b|\btobacco\b|\bcigar|\bvape\b|\bsmoke\s*shop\b/i, 'disc_alcohol_tobacco'],
    [/\bairlines?\b|\bhotel\b|\bmarriott\b|\bhilton\b|\bairbnb\b|\bexpedia\b|\bresort\b|\bcruise\b|\bvacation\b/i, 'disc_travel'],
    [/\bcinema\b|\bmovie\b|\bamc\b|\bticketmaster\b|\bconcert\b|\bstubhub\b|\bsteam\s*games\b|\bxbox\b|\bplaystation\b/i, 'disc_entertainment'],
    [/\bamazon\b|\bamzn\b|\btarget\b|\bbest\s*buy\b|\bkohl'?s\b|\bmacy'?s\b|\bross\b|\bmarshalls\b|\btj\s*maxx\b|\bold\s*navy\b|\babercrombie\b|\bnordstrom\b|\betsy\b|\bebay\b|\btemu\b|\bshein\b/i, 'disc_shopping'],

    [/\bfleet\s*feet\b|\bshoe\b|\bfootwear\b|\bdsw\b|\bclothing\b|\bapparel\b/i, 'clothing'],
    [/\bmattress\b|\bfurniture\b|\bnordictrack\b|\bwayfair\b|\bikea\b/i, 'disc_shopping'],

    // --- aggressive educated guesses (marked for review) ----------------------
    // Common household appliances and kitchen items - guess discretionary shopping
    [/\bkitchen\b|\bappliance\b|\bcooking\b|\bstove\b|\boven\b|\bblender\b|\btoaster\b/i, 'disc_shopping', REVIEW],
    // Home goods stores and general shopping
    [/\bbed\s*bath\b|\bwilliams\s*sonoma\b|\bte(?:ch|chnology)(?!\s*support)\b|\bsmall\s*(?:appliance|app)\b/i, 'disc_shopping', REVIEW],
    // Tech and electronics - guess discretionary shopping
    [/\btech\b|\belectron\b|\bcomputer\b|\blaptop\b|\bcamera\b|\bjbl\b|\bsonos\b|\bapple\s+store\b|\bgeek\s*squad\b/i, 'disc_shopping', REVIEW],
    // General retail/stores not caught above
    [/\bstore\b|\bshop\b|\bmart\b|\bmarket\b/i, 'disc_shopping', REVIEW],
    // Subscription services
    [/\bsubscript\b|\bmembership\b|\bclub\b/i, 'disc_subscription_other', REVIEW],
    // Services and misc
    [/\bservice\b|\brepair\b|\blabor\b|\binstallat\b/i, 'housing_maintenance_repair', REVIEW],
    // Names or personal services (guess beauty/grooming)
    [/\b[a-z]{2,}\s+(?:salon|studio|services?|studio|spa|wellness|health|coach|training)\b/i, 'disc_beauty', REVIEW],
    // Companies with INC/LLC/Corp that don't match specific patterns (guess shopping)
    [/\binc\b|\bllc\b|\bcorp\b|\bco\b$|\b&\s*co\b/i, 'disc_shopping', REVIEW],

    // --- not spending --------------------------------------------------------
    // Confirmed by counsel as movement between cash and investment accounts:
    // an asset moving, not money earned, so it must never count as income.
    [/\bjpmorgan\s+chase\s+chase\s+ach\b/i, 'investment_transfer'],
    [/\bpayroll\b|\bdirect\s*dep\b|\bsalary\b|\bpaycheck\b|\bdir\s*dep\b|\bresourcing\s*edge\b|\bpaychex\b|\badp\b|\bgusto\b/i, 'employment_income'],
    [/\bremote\s*online\s*deposit\b|\bmobile\s*deposit\b|\bdeposit\b/i, 'other_income'],
    [/\birs\b|\btax\s*refund\b|\btax\s*rebate\b|\bfranchise\s*tax\b|\bdept\s*of\s*rev(?:enue)?\b/i, 'tax'],
    [/\bwithdraw(?:al|n|s)?\b|\bcash\s*advance\b/i, 'cash_withdrawal'],
    [/\btransfer\b|\bzelle\b|\bvenmo\b|\bpaypal\b|\bwire\b|\bonline\s*banking\s*transfer\b/i, 'transfer'],
  ];

  // A rule may carry a third element, REVIEW: the merchant is recognisable but
  // the category is a best guess (whose therapist, whether a course is a
  // child's education, whether a brand is "luxury"). Those rows are still
  // assigned so totals stay close, but they are flagged for a person to
  // confirm rather than silently trusted or left unmapped.
  function classifyDetailed(description) {
    const d = String(description || '');
    if (!d) return null;
    for (let i = 0; i < RULES.length; i++) {
      if (RULES[i][0].test(d)) {
        return { code: RULES[i][1], confidence: RULES[i][2] === REVIEW ? 'review' : 'high' };
      }
    }
    return null;
  }

  function classify(description) {
    const hit = classifyDetailed(description);
    return hit ? hit.code : null;
  }

  function get(code) {
    if (!code) return null;
    return BY_CODE[code] || BY_CODE[LEGACY_ALIASES[code]] || null;
  }

  function normalize(code) {
    const c = get(code);
    return c ? c.code : null;
  }

  function afiLineFor(code) {
    const c = get(code);
    return c ? c.afiLine : null;
  }

  function treatmentFor(code) {
    const c = get(code);
    return c ? c.treatment : null;
  }

  function labelFor(code) {
    const c = get(code);
    return c ? c.label : null;
  }

  // "Housing: Repairs & maintenance" - labels alone repeat across subsections.
  function displayLabel(code) {
    const c = get(code);
    if (!c) return null;
    return c.label.toLowerCase().startsWith(c.subsection.toLowerCase()) ? c.label : `${c.subsection}: ${c.label}`;
  }

  function sectionFor(code) {
    const c = get(code);
    if (!c) return null;
    return SECTIONS.find((s) => s.key === c.section) || null;
  }

  // Only "need" spending belongs in the eight AFI expense boxes. Support,
  // debts, legal costs, lifestyle and excluded items each report separately.
  function countsAsNeed(code) {
    return treatmentFor(code) === 'need';
  }

  // A section decides how a total may be used, so a custom category inherits
  // its treatment from the section it is filed under.
  const SECTION_TREATMENT = {
    court_ordered: 'support',
    basic_living: 'need',
    child_related: 'need',
    debts: 'debt',
    legal: 'legal',
    discretionary: 'discretionary',
    excluded: 'excluded',
    non_expense: 'none',
  };

  // Categories a person adds from the mapper when nothing in the taxonomy
  // fits. Accepts [{ code, label, section, afiLine }]; safe to call repeatedly.
  function defineCustom(defs) {
    (defs || []).forEach((d) => {
      if (!d || !d.code || !d.label || !SECTION_TREATMENT[d.section]) return;
      const afiLine = AFI_LINES.some((l) => l.line === d.afiLine) ? d.afiLine : null;
      const cat = C(d.code, d.section, 'Custom', d.label, afiLine, SECTION_TREATMENT[d.section]);
      const existing = CATEGORIES.findIndex((c) => c.code === d.code);
      if (existing >= 0) CATEGORIES[existing] = cat; else CATEGORIES.push(cat);
      BY_CODE[d.code] = cat;
    });
  }

  // Money moving between the party's own accounts, or out as cash: neither
  // income nor spending, so it is excluded from both analyses.
  const MOVEMENT_CODES = ['transfer', 'investment_transfer', 'cash_withdrawal'];

  function isAccountMovement(code) {
    return MOVEMENT_CODES.includes(normalize(code));
  }

  // Whether a row may be left OUT of income as account movement. A best-guess
  // category must never be what removes money from income - excluding real
  // income on a guess understates ability to pay - so an unconfirmed review
  // guess keeps the row in income until a person confirms it.
  function excludedFromIncome(code, description, mappingStatus) {
    if (!isAccountMovement(code)) return false;
    if (mappingStatus === 'confirmed') return true;
    const hit = classifyDetailed(description);
    return !(hit && hit.confidence === 'review' && hit.code === normalize(code));
  }

  function categoriesForSection(sectionKey) {
    return CATEGORIES.filter((c) => c.section === sectionKey);
  }

  return {
    SECTIONS,
    CATEGORIES,
    AFI_LINES,
    LEGACY_ALIASES,
    RULES,
    REVIEW,
    classify,
    classifyDetailed,
    get,
    normalize,
    afiLineFor,
    treatmentFor,
    labelFor,
    displayLabel,
    sectionFor,
    countsAsNeed,
    isAccountMovement,
    excludedFromIncome,
    defineCustom,
    categoriesForSection,
  };
});
