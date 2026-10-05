import { Redirect } from 'expo-router';
import { useEffect } from 'react';

import { useAddMenu } from '@/components/tab-action-menu';

// Route behind the center "Add" tab. Its tab slot is an empty spacer and the
// raised button (TabActionMenu, see app-tabs.tsx) opens the menu without
// navigating here, so this only runs for a deep link or a restored session:
// go Home and open the add menu there instead of showing a blank screen.
export default function AddTab() {
  useEffect(() => {
    useAddMenu.getState().setOpen(true);
  }, []);
  return <Redirect href="/" />;
}
