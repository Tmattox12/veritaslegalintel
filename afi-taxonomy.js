/* Shared AFI-aligned expense taxonomy (Arizona).
 *
 * One definition used by the statement parser, the AFI mapper UI and the
 * expense workbook, so a category means the same thing everywhere.
 *
 * Structure mirrors the AFI sections a court actually reads:
 *   6  court-ordered support        - feeds the ability-to-pay analysis
 *   7  basic living expenses        - the only expenses treated as "needs"
 *   8  child-related expenses       - feeds the child support worksheet
 *   9  debts and obligations        - financial stability / ability to pay
 *   10 legal and case expenses      - may be allocated between the parties
 *   discretionary                   - lifestyle; NOT needs, kept separate so
 *                                     they cannot inflate a support claim
 *   excluded                        - courts reject these outright
 *
 * afiLine is the roll-up into the eight inputs on afi-form-populator.html.
 * null means the category has no home on that form: it is still reported in
 * its own section, it just cannot be pushed into one of the eight boxes.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.AFITaxonomy = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const SECTIONS = [
    { key: 'court_ordered', label: 'Court-Ordered Payments', afiSection: '6' },
    { key: 'basic_living', label: 'Basic Living Expenses', afiSection: '7' },
    { key: 'child_related', label: 'Child-Related Expenses', afiSection: '8' },
    { key: 'debts', label: 'Debts & Financial Obligations', afiSection: '9' },
    { key: 'legal', label: 'Legal & Case-Related Expenses', afiSection: '10' },
    { key: 'discretionary', label: 'Discretionary / Lifestyle', afiSection: '7 (Misc)' },
    { key: 'excluded', label: 'Excluded — not allowed in AFI', afiSection: null },
    { key: 'non_expense', label: 'Not an expense', afiSection: null },
  ];

  // treatment drives how a total may be used:
  //   need          - supports a claim of financial need
  //   support       - court-ordered support in or out
  //   debt          - obligation affecting ability to pay
  //   legal         - case cost, may be allocated
  //   discretionary - lifestyle, reported but never a "need"
  //   excluded      - must not appear in AFI totals
  //   none          - income, transfers: not spending at all
  const C = (code, section, subsection, label, afiLine, treatment) =>
    ({ code, section, subsection, label, afiLine, treatment });

  const CATEGORIES = [
    // ---- Section 6: court-ordered payments -------------------------------
    C('child_support_paid', 'court_ordered', 'Child Support', 'Child support paid', null, 'support'),
    C('child_support_received', 'court_ordered', 'Child Support', 'Child support received', null, 'support'),
    C('child_support_arrears', 'court_ordered', 'Child Support', 'Child support arrears', null, 'support'),
    C('child_support_addon', 'court_ordered', 'Child Support', 'Add-on reimbursement (medical/childcare/education)', null, 'support'),
    C('spousal_paid', 'court_ordered', 'Spousal Maintenance', 'Spousal maintenance paid', null, 'support'),
    C('spousal_received', 'court_ordered', 'Spousal Maintenance', 'Spousal maintenance received', null, 'support'),
    C('spousal_arrears', 'court_ordered', 'Spousal Maintenance', 'Spousal maintenance arrears', null, 'support'),

    // ---- Section 7: basic living expenses (the "needs") -------------------
    C('housing_rent_mortgage', 'basic_living', 'Housing', 'Rent / mortgage', 5, 'need'),
    C('housing_property_tax', 'basic_living', 'Housing', 'Property taxes', 5, 'need'),
    C('housing_insurance', 'basic_living', 'Housing', "Homeowner's insurance", 5, 'need'),
    C('housing_hoa', 'basic_living', 'Housing', 'HOA fees', 5, 'need'),
    C('housing_maintenance', 'basic_living', 'Housing', 'Repairs & maintenance', 5, 'need'),
    C('utilities_electric', 'basic_living', 'Utilities', 'Electricity', 6, 'need'),
    C('utilities_gas', 'basic_living', 'Utilities', 'Natural gas', 6, 'need'),
    C('utilities_water', 'basic_living', 'Utilities', 'Water / sewer / garbage', 6, 'need'),
    C('utilities_internet', 'basic_living', 'Utilities', 'Internet', 6, 'need'),
    C('utilities_phone', 'basic_living', 'Utilities', 'Mobile phone', 6, 'need'),
    C('utilities_basic_cable', 'basic_living', 'Utilities', 'Basic cable (news/communication)', 6, 'need'),
    C('food_groceries', 'basic_living', 'Food & Household', 'Groceries', 8, 'need'),
    C('food_household_supplies', 'basic_living', 'Food & Household', 'Household cleaning supplies', 8, 'need'),
    C('food_school_lunch', 'basic_living', 'Food & Household', 'School lunches', 8, 'need'),
    C('transport_car_payment', 'basic_living', 'Transportation', 'Car payment', 7, 'need'),
    C('transport_car_insurance', 'basic_living', 'Transportation', 'Car insurance', 7, 'need'),
    C('transport_fuel', 'basic_living', 'Transportation', 'Fuel', 7, 'need'),
    C('transport_maintenance', 'basic_living', 'Transportation', 'Repairs & maintenance', 7, 'need'),
    C('transport_parking_transit', 'basic_living', 'Transportation', 'Parking / transit', 7, 'need'),
    C('medical_premium', 'basic_living', 'Medical', 'Health insurance premium', 1, 'need'),
    C('medical_dental_vision_premium', 'basic_living', 'Medical', 'Dental / vision premium', 1, 'need'),
    C('medical_unreimbursed', 'basic_living', 'Medical', 'Unreimbursed medical/dental/vision', 3, 'need'),
    C('medical_prescriptions', 'basic_living', 'Medical', 'Prescriptions', 3, 'need'),
    // Clothing and personal necessities are Section 7 needs with no box on the
    // eight-line form; they report in their own section rather than vanish.
    C('clothing', 'basic_living', 'Clothing', 'Clothing', null, 'need'),
    C('clothing_laundry', 'basic_living', 'Clothing', 'Laundry / dry cleaning', null, 'need'),
    C('personal_grooming', 'basic_living', 'Personal Necessities', 'Basic grooming (haircuts)', null, 'need'),
    C('personal_hygiene', 'basic_living', 'Personal Necessities', 'Personal hygiene items', null, 'need'),

    // ---- Section 8: child-related ----------------------------------------
    C('child_health_premium', 'child_related', 'Health & Medical', "Child's health insurance premium", 1, 'need'),
    C('child_medical_unreimbursed', 'child_related', 'Health & Medical', 'Unreimbursed child medical/dental/vision', 3, 'need'),
    C('child_therapy', 'child_related', 'Health & Medical', 'Therapy / special needs services', 3, 'need'),
    C('childcare_daycare', 'child_related', 'Childcare', 'Daycare', 2, 'need'),
    C('childcare_afterschool', 'child_related', 'Childcare', 'After-school care', 2, 'need'),
    C('childcare_babysitting', 'child_related', 'Childcare', 'Babysitting (work-related)', 2, 'need'),
    C('education_tuition', 'child_related', 'Education', 'Tuition', 4, 'need'),
    C('education_books', 'child_related', 'Education', 'Books', 4, 'need'),
    C('education_technology', 'child_related', 'Education', 'Technology', 4, 'need'),
    C('education_supplies', 'child_related', 'Education', 'School supplies', 4, 'need'),
    C('education_fees', 'child_related', 'Education', 'School fees', 4, 'need'),
    C('child_activities', 'child_related', 'Activities', 'Sports / clubs / lessons / camps', null, 'need'),
    C('parenting_time_travel', 'child_related', 'Parenting Time', 'Travel for exchanges', null, 'need'),
    C('parenting_supervised', 'child_related', 'Parenting Time', 'Supervised visitation fees', null, 'need'),

    // ---- Section 9: debts -------------------------------------------------
    C('debt_mortgage', 'debts', 'Secured', 'Mortgage', null, 'debt'),
    C('debt_auto_loan', 'debts', 'Secured', 'Auto loan', null, 'debt'),
    C('debt_heloc', 'debts', 'Secured', 'HELOC', null, 'debt'),
    C('debt_credit_card', 'debts', 'Unsecured', 'Credit card', null, 'debt'),
    C('debt_personal_loan', 'debts', 'Unsecured', 'Personal loan', null, 'debt'),
    C('debt_medical', 'debts', 'Unsecured', 'Medical debt', null, 'debt'),
    C('debt_student_loan', 'debts', 'Student Loans', 'Student loan', null, 'debt'),
    C('debt_garnishment', 'debts', 'Court-Ordered', 'Garnishment / judgment / restitution', null, 'debt'),

    // ---- Section 10: legal ------------------------------------------------
    C('legal_attorney_fees', 'legal', 'Attorney Fees', 'Attorney fees / retainer', null, 'legal'),
    C('legal_expert_fees', 'legal', 'Attorney Fees', 'Expert witness fees', null, 'legal'),
    C('legal_court_costs', 'legal', 'Court Costs', 'Filing / mediation / parenting coordinator', null, 'legal'),
    C('legal_professional', 'legal', 'Professional Services', 'Forensic accountant / evaluator / valuation', null, 'legal'),

    // ---- Discretionary / lifestyle ---------------------------------------
    C('disc_dining', 'discretionary', 'Entertainment', 'Dining out', null, 'discretionary'),
    C('disc_entertainment', 'discretionary', 'Entertainment', 'Movies / concerts / events', null, 'discretionary'),
    C('disc_travel', 'discretionary', 'Entertainment', 'Vacations / travel', null, 'discretionary'),
    C('disc_streaming', 'discretionary', 'Subscriptions', 'Streaming services', null, 'discretionary'),
    C('disc_gym', 'discretionary', 'Subscriptions', 'Gym membership', null, 'discretionary'),
    C('disc_subscription_other', 'discretionary', 'Subscriptions', 'Other subscriptions', null, 'discretionary'),
    C('disc_pets', 'discretionary', 'Pets', 'Pet food / vet / grooming', null, 'discretionary'),
    C('disc_beauty', 'discretionary', 'Personal Lifestyle', 'Beauty / spa treatments', null, 'discretionary'),
    C('disc_alcohol_tobacco', 'discretionary', 'Personal Lifestyle', 'Alcohol / tobacco', null, 'discretionary'),
    C('disc_gifts', 'discretionary', 'Gifts', 'Gifts / holiday spending', null, 'discretionary'),
    C('disc_shopping', 'discretionary', 'Personal Lifestyle', 'General retail / shopping', null, 'discretionary'),

    // ---- Excluded ---------------------------------------------------------
    C('excl_business', 'excluded', 'Business Expenses', 'Business expense', null, 'excluded'),
    C('excl_non_party', 'excluded', 'Non-Party Individuals', 'Expense for a non-party', null, 'excluded'),
    C('excl_luxury', 'excluded', 'Luxury Items', 'Luxury purchase', null, 'excluded'),

    // ---- Not spending -----------------------------------------------------
    C('employment_income', 'non_expense', 'Income', 'Employment income', null, 'none'),
    C('other_income', 'non_expense', 'Income', 'Other income', null, 'none'),
    C('transfer', 'non_expense', 'Transfer', 'Account transfer', null, 'none'),
    C('investment_transfer', 'non_expense', 'Cash / Investments', 'Cash / investment account transfer', null, 'none'),
    C('cash_withdrawal', 'non_expense', 'Cash', 'Cash withdrawal (purpose untraced)', null, 'none'),
    C('tax', 'non_expense', 'Tax', 'Tax payment / refund', null, 'none'),
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
    [/\bmister\s*car\s*wash\b|\bcar\s*wash\b/i, 'transport_maintenance'],
    [/\buber\s*\*?\s*trip\b|\blyft\b/i, 'transport_parking_transit'],
    [/\bwaste\s*mgmt\b/i, 'utilities_water'],
    [/\bswpestsolutions\b|\bpest\s*solutions\b/i, 'housing_maintenance'],
    [/\bsams\s*scan|\bwholefds\b|\bwm\s*supercenter\b/i, 'food_groceries'],
    [/\bbanner\s*(?:health|univ)|\brincon\s*asc\b|\bpathology\s*specialists\b|\bliver\s*health\b|\bkidney\s*institut|\blaboratory\s*corporation\b|\bchiropractic\b|\bphysical\s*medicin|\bm\.?d\.?,?\s*p\b|\bmychart\b/i, 'medical_unreimbursed'],
    [/\bbarber|\bgreat\s*clips\b|\bsupercuts\b|\bsport\s*clips\b/i, 'personal_grooming'],
    [/\bulta\b|\bsephora\b|\bthrivecausemetics\b/i, 'disc_beauty'],
    [/\btaekwondo\b|\bmartial\s*arts\b/i, 'child_activities'],
    [/\bamphitheater\s*public\s*scho|\bpima\s*county\s*amphithea|\bpublic\s*schools?\b/i, 'education_fees'],
    [/\bhtl\s*\*|\bhampton\s*inn|\bhamptoninn|\bsonesta\b|\bclarion\s*hotels?\b|\bcourtyard\b|\bdays\s*inns?\b|\bdaysinn|\bhotels\.?com\b|\bhotelcom\b|\bvrbo\b/i, 'disc_travel'],
    [/\btopgolf\b|\bcinemas?\b|\bultrasignup\b|\braceroster\b|\bmarathon\b(?!\s*(?:petro|gas))|\bstate\s*park\b|\bfarm\s*festival|\bpumpkin\s*pa/i, 'disc_entertainment'],
    // TST* is the Toast point-of-sale, used almost exclusively by restaurants.
    [/\btst\s*\*|\bristorante\b|\bin-n-out\b|\bchick-fil-a\b|\bjimmy\s*johns\b|\bdairy\s*queen\b|\bburger\s*king\b|\barbys\b|\bwingstop\b|\bdunkin\b|\bcrumbl\b|\btrue\s*food\s*kitchen\b|\bhandels\s*homemade\b|\bchoice\s*greens\b|\bpitalian\b/i, 'disc_dining'],
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
    [/\bbraces\b|\borthodont/i, 'child_medical_unreimbursed', REVIEW],
    [/\blmt\b|\bmassage\b/i, 'disc_beauty', REVIEW],
    [/\bgloss\s*\*|\ballisonwade\b/i, 'disc_beauty', REVIEW],
    [/\bintimina\b|\bus\s*intimn\b/i, 'personal_hygiene', REVIEW],
    [/\bmvd\b|\btitle\s*&\s*tag\b/i, 'transport_maintenance', REVIEW],
    [/\bu-?haul\b|\bmoving\s*&\s*labo|\bmoving\s*and\s*labor\b/i, 'housing_maintenance', REVIEW],
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
    sectionFor,
    countsAsNeed,
    isAccountMovement,
    excludedFromIncome,
    categoriesForSection,
  };
});
