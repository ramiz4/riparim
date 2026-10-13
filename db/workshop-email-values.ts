// A scalar aggregate keeps the number of email addresses independent from the
// visit aggregation. Evidence is never selected into public/owner responses.
export const researchedEmailsSql=`(SELECT json_group_array(email) FROM (SELECT e.email FROM workshop_email_addresses e WHERE e.workshop_id=w.id ORDER BY e.position,e.email_key))`;
