CREATE OR REPLACE FUNCTION get_admin_stats()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  total_users INT;
  total_gens INT;
  gens_today INT;
  active_users_today INT;
BEGIN
  -- Total users
  SELECT count(*) INTO total_users FROM auth.users;

  -- Total clippings
  SELECT count(*) INTO total_gens FROM public.clippings;

  -- Clippings today (UTC boundary matching the IST logic if we want, or just simple interval)
  -- For now just using UTC for simplicity
  SELECT count(*) INTO gens_today 
  FROM public.clippings 
  WHERE created_at >= CURRENT_DATE;

  -- Active users today
  SELECT count(DISTINCT user_id) INTO active_users_today 
  FROM public.clippings 
  WHERE created_at >= CURRENT_DATE;

  RETURN json_build_object(
    'totalUsers', total_users,
    'totalGenerationsAllTime', total_gens,
    'totalGenerationsToday', gens_today,
    'activeUsersToday', active_users_today
  );
END;
$$;
