using System;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;
using System.IO;
using System.Web;

namespace BingWebGL
{
    public class ImageHandler : IHttpHandler
    {
        private const bool _drawTileBoundary = false;
        private const bool _saveImageToDisk = false;
     
        /// <summary>
        /// You will need to configure this handler in the Web.config file of your 
        /// web and register it with IIS before being able to use it. For more information
        /// see the following link: http://go.microsoft.com/?linkid=8101007
        /// </summary>
        #region IHttpHandler Members

        public bool IsReusable
        {
            // Return false in case your Managed Handler cannot be reused for another request.
            // Usually this would be false in case you have some state information preserved per request.
            get { return true; }
        }

        public void ProcessRequest(HttpContext context)
        {
            string quadKey = context.Request.QueryString["quadKey"];
            if (quadKey == null)
            {
                context.Response.Clear();
                context.Response.ContentType = getContentType(context.Request.PhysicalPath);
                context.Response.WriteFile(context.Request.PhysicalPath);
                context.Response.End();
            }
            else
            {
                string imageUrl = "http://ak.dynamic.t0.tiles.virtualearth.net/comp/ch/" + quadKey + "?mkt=en-us&it=A,G,L,LA&shading=hill&og=31&n=z";
                context.Response.Clear();
                context.Response.ContentType = getContentType(context.Request.PhysicalPath);
                //context.Response.WriteFile(context.Request.PhysicalPath);
                Image img = DownloadImage(imageUrl);
                if (img == null)
                {
                    context.Response.Clear();
                    context.Response.ContentType = getContentType(context.Request.PhysicalPath);
                    context.Response.WriteFile(context.Request.PhysicalPath);
                    context.Response.End();
                }
                else
                {
                    if (_saveImageToDisk)
                    {
                        string imgFileName= context.Request.MapPath("tiles/maptile_" + quadKey + ".jpg");

                        img.Save(imgFileName);
                    }

                    if (_drawTileBoundary)
                    {
                        var graphicsImg = Graphics.FromImage(img);
                        graphicsImg.CompositingQuality = CompositingQuality.HighQuality;
                        graphicsImg.SmoothingMode = SmoothingMode.HighQuality;
                        graphicsImg.InterpolationMode = InterpolationMode.HighQualityBicubic;

                        var imageRectangle = new Rectangle(0, 0, img.Width, img.Height);
                        graphicsImg.DrawImage(img, imageRectangle);

                        Color color = Color.White;
                        SolidBrush brush = new SolidBrush(color);
                        Pen pen = new Pen(brush, 4);
                        graphicsImg.DrawRectangle(pen, imageRectangle);
                    }

                    MemoryStream ms = new MemoryStream();
                    img.Save(ms, System.Drawing.Imaging.ImageFormat.Gif);
                    byte[] imageData = ms.ToArray();
                    context.Response.BinaryWrite(imageData);
                    context.Response.Cache.SetExpires(DateTime.Now.AddDays(7));
                    context.Response.Cache.SetValidUntilExpires(true);

                    context.Response.End();

       
                }
            }
        }

        string getContentType(String path)
        {
            switch (Path.GetExtension(path))
            {
                case ".bmp": return "Image/bmp";
                case ".gif": return "Image/gif";
                case ".jpg": return "Image/jpeg";
                case ".png": return "Image/png";
                default: break;
            }
            return "";
        }
        ImageFormat getImageFormat(String path)
        {
            switch (Path.GetExtension(path))
            {
                case ".bmp": return ImageFormat.Bmp;
                case ".gif": return ImageFormat.Gif;
                case ".jpg": return ImageFormat.Jpeg;
                case ".png": return ImageFormat.Png;
                default: break;
            }
            return ImageFormat.Jpeg;
        }

        /// <summary>
        /// Function to download Image from website
        /// </summary>
        /// <param name="_URL">URL address to download image</param>
        /// <returns>Image</returns>
        public Image DownloadImage(string _URL)
        {
            Image _tmpImage = null;

            try
            {
                // Open a connection
                System.Net.HttpWebRequest _HttpWebRequest = (System.Net.HttpWebRequest)System.Net.HttpWebRequest.Create(_URL);

                _HttpWebRequest.AllowWriteStreamBuffering = true;

                // You can also specify additional header values like the user agent or the referer: (Optional)
                _HttpWebRequest.UserAgent = "Mozilla/4.0 (compatible; MSIE 7.0; Windows NT 5.1)";
                _HttpWebRequest.Referer = "http://www.google.com/";

                // set timeout for 20 seconds (Optional)
                _HttpWebRequest.Timeout = 20000;

                // Request response:
                System.Net.WebResponse _WebResponse = _HttpWebRequest.GetResponse();

                // Open data stream:
                System.IO.Stream _WebStream = _WebResponse.GetResponseStream();

                // convert webstream to image
                _tmpImage = Image.FromStream(_WebStream);

                // Cleanup
                _WebResponse.Close();
                _WebResponse.Close();
            }
            catch (Exception _Exception)
            {
                // Error
                Console.WriteLine("Exception caught in process: {0}", _Exception.ToString());
                return null;
            }

            return _tmpImage;
        }



        #endregion
    }
}
