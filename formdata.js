/*
  Form wording and pre-filled answers. Edit this file to change defaults.
  on: true  -> the box is ticked
  r: remark text printed on the form
  field: filled in from the UTN screen ('product', 'expiry' or 'spec')
  The wording (including original spelling) follows form S2-CIV-CF-PFC-FRM-FGJV0008.
*/
var FORM = {
  no: 'S2-CIV-CF-PFC-FRM-FGJV0008',
  title1: 'SEGMENT REPAIR INSPECTION CHECKLIST',
  title2: 'SEGMENT REPAIR INSPECTION CHECKLIST (Photos)',
  repairType: 'AGG POP OUT',
  cms: '0050_I',
  types: ['SC1', 'SC2', 'SC4', 'SC5', 'SC7', 'IPT'],
  defaultProduct: 'Master Strength 1444 (A&B) + FIL 5 Sand (AP25091001 APD2509251)',
  sections: [
    {
      title: 'PRODUCT DETAIL',
      after: 'repairType',
      rows: [
        { t: '1. Confirm Product Name and batch', on: true, field: 'product' },
        { t: '2. Review Data Sheet & SDS', on: true, r: 'Reviewed' },
        { t: '3. Check Expiry and Storage', on: true, field: 'expiry' },
        { t: '4. Verify Companion Products', on: true, r: 'FIL 5 sand' },
        { t: '5. Comfirm Compatibility of Repair Material', on: true, r: 'Confirmed' },
        { t: '6. Verify Project Specification Requirements', on: true, field: 'spec' }
      ]
    },
    {
      title: 'PRE REPAIR',
      rows: [
        { t: '1. Area to received repair chipped back to good concrete?', on: true, r: 'Prepared and checked' },
        { t: '2. Area to received repair clean?', on: true, r: 'As per repair method' },
        { t: '3. Area to received repair pre-wetted?', on: false, r: 'N/A' },
        { t: '4. Bonding Agent Applied ? (if applicable)', on: true, r: '1444 Part A & B' },
        { t: '5. Repair materials in satisfactory status and approved for use?', on: true, r: 'Satisfactory' },
        { t: '6. Support equipment available and in working order?', on: true, r: 'All in good condition' },
        { t: '7. Formwork secures, in position and leak free? (if applicable)', on: false, r: 'N/A' },
        { t: '8. Photos Taken?', on: true, r: 'Yes (see attached)' }
      ]
    },
    {
      title: 'IN PROGRESS REPAIR',
      rows: [
        { t: '1. Mixing of Material As per Manufacturer Reccomendation?', on: true, r: 'As per approved method endorsed by manufacturer' },
        { t: '2. Application of Material as Per Manufacturer Reccomendation?', on: true, r: 'As per approved method endorsed by manufacturer' },
        { t: '3. Coverage & Flow as per Manufacturer Reccomendation?', on: true, r: 'As per approved method endorsed by manufacturer' },
        { t: '4. Compaction (Dry Pack Grout if applicable)', on: false, r: 'N/A' },
        { t: '5. Repair Material Leakage, Observed?', on: false, r: 'N/A' },
        { t: '6. Sample Taken?', on: false, r: 'N/A' },
        { t: '7. Photos Taken?', on: true, r: 'Yes (see attached)' }
      ]
    },
    {
      title: 'POST REPAIR CHECKS',
      rows: [
        { t: '1. Finsih, Edges, Bond is/are Inspected?', on: true, r: '' },
        { t: '2. Cracking and Shinkage is/are Observed?', on: false, r: 'Not observed' },
        { t: '3. Curing Time is/are Confrimed?', on: true, r: 'Confirmed' },
        { t: '4. Photos Before / During / After', on: true, r: 'Taken' }
      ]
    }
  ]
};
if (typeof module !== 'undefined') module.exports = { FORM: FORM };
