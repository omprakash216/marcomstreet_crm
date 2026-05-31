const mysql = require('mysql2/promise');
async function run() {
  const conn = await mysql.createConnection({host:'127.0.0.1', user:'root', password:'', database:'marcom_street_crm', port:3306});
  const queryStr = `INSERT INTO employees (
      company_id, employee_code, name, email, phone, password, role, department_id, designation, status, 
      address, permanent_address, dob, gender, marital_status, emergency_contact_name, 
      emergency_contact_phone, joining_date, employment_type, probation_period, basic_salary, 
      hra, conveyance, medical_allowance, lta, other_allowances, previous_company, 
      previous_designation, experience_years, qualification, bank_account, bank_name, 
      ifsc_code, branch_name, account_holder_name, pan_number, aadhar_number
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`;
  const params = [
      1, 'EMP123', 'Test', 'test@test.com', null, 'hash',
      'employee', null, null, 'active',
      null, null, null, null,
      null, null, null,
      null, 'full_time', '3',
      null, null, null, null,
      null, null, null,
      null, null, null,
      null, null, null, null,
      null, null, null
  ];
  try {
    await conn.execute(queryStr, params);
    console.log('Success!');
  } catch (err) {
    console.error(err.message);
  }
  await conn.end();
}
run();
